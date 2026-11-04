import { sealIntake, verifySeal } from '../domain/scene-proof.js';
import { evaluateClaimReady } from '../domain/claim-ready.js';
import { routePriority } from '../domain/priority-router.js';
import { evaluateDispatchGate } from '../domain/dispatch-gate.js';
import { selectCrew, createLease, acceptLease, failoverIfDue } from '../domain/standby-roster.js';
import { buildEvidenceBundle } from '../domain/evidence-bundle.js';
import { buildSpokenReceipt } from '../domain/spoken-receipt.js';
import { assertReader, assertWriter, LeastPrivilegeError } from '../ports.js';

// Application service shared by Forge resolvers, triggers, Rovo actions,
// and the MCP tools. Reader and Evaluator run everywhere. Writer methods
// are the only mutations and they re-verify the gate receipt first.
export function createDispatchService({ reader, writer, clock }) {
  assertReader(reader);
  const now = typeof clock === 'function' ? clock : () => new Date().toISOString();
  const requireWriter = () => assertWriter(writer);

  // The gate is always evaluated as the plan a commander would approve
  // (commanderApproved: true) so the receipt hash is stable between the
  // verify step and the reserve step. Approval itself is enforced in
  // reserveCrew, which refuses without the flag and the matching hash.
  async function loadGateContext(issueKey) {
    const incident = await reader.getIncident(issueKey);
    if (!incident) throw new Error('Unknown incident ' + issueKey);
    const asset = await reader.getLinkedAsset(issueKey);
    const sop = asset ? await reader.getSafetySop(asset.assetKey) : null;
    const roster = await reader.getRoster();
    const crew = selectCrew(roster, {
      hazardClass: incident.hazardClass,
      requiredParts: asset ? asset.requiredParts : [],
    }) ?? roster.find((c) => c.onShift) ?? null;
    const gate = evaluateDispatchGate({
      incident,
      asset,
      sop,
      crew,
      policy: { autoDispatch: false, commanderApproved: true },
      now: now(),
    });
    return { incident, asset, sop, roster, crew, gate };
  }

  const service = {
    async submitIntake(issueKey, intake) {
      const w = requireWriter();
      const { sealed, redactions, evidenceHash } = sealIntake(intake);
      const claim = evaluateClaimReady(sealed);
      const routing = routePriority(sealed, 0);
      const record = { issueKey, sealed, redactions, evidenceHash, claim, routing, storedAt: now() };
      await w.saveIntakeRecord(issueKey, record);
      await w.setPriorityLane(issueKey, routing.lane);
      return record;
    },

    async verifySafety(issueKey) {
      const ctx = await loadGateContext(issueKey);
      return {
        issueKey,
        allowed: ctx.gate.allowed,
        blockedReasons: ctx.gate.blockedReasons,
        checks: ctx.gate.checks,
        receiptHash: ctx.gate.receiptHash,
        assetKey: ctx.asset ? ctx.asset.assetKey : null,
        sopPageId: ctx.sop ? ctx.sop.pageId : null,
        crewId: ctx.crew ? ctx.crew.crewId : null,
        requiresCommanderApproval: true,
      };
    },

    async reserveCrew(issueKey, { commanderApproved, approvedReceiptHash } = {}) {
      const w = requireWriter();
      if (commanderApproved !== true) {
        throw new LeastPrivilegeError('Crew reservation refused: commander approval is required.');
      }
      const ctx = await loadGateContext(issueKey);
      if (!ctx.gate.allowed) {
        throw new Error('Dispatch blocked for ' + issueKey + ': ' + ctx.gate.blockedReasons.join(' '));
      }
      if (!approvedReceiptHash || approvedReceiptHash !== ctx.gate.receiptHash) {
        throw new LeastPrivilegeError(
          'Approval does not match the current dispatch plan. Approved hash '
          + (approvedReceiptHash ?? '(none)') + ', current hash ' + ctx.gate.receiptHash + '. Re-verify and approve again.',
        );
      }
      const lease = createLease({ issueKey, crew: ctx.crew, now: now() });
      await w.saveLease(lease);
      if (ctx.crew.accountId) await w.assignCrew(issueKey, ctx.crew.accountId);
      await w.postReceipt(issueKey,
        'FrontBox: crew ' + ctx.crew.crewId + ' reserved under lease ' + lease.leaseId
        + ' until ' + lease.acceptBy + '. Gate receipt ' + ctx.gate.receiptHash + '.');
      return { lease, receiptHash: ctx.gate.receiptHash };
    },

    async acceptReservation(issueKey, crewId) {
      const w = requireWriter();
      const lease = await reader.getLease(issueKey);
      if (!lease) throw new Error('No lease found for ' + issueKey);
      const accepted = acceptLease(lease, crewId, now());
      await w.saveLease(accepted);
      return accepted;
    },

    async runFailover(issueKey) {
      const w = requireWriter();
      const lease = await reader.getLease(issueKey);
      if (!lease) return { changed: false, lease: null, receipt: null, reason: 'No lease found for ' + issueKey + '.' };
      const incident = await reader.getIncident(issueKey);
      const asset = await reader.getLinkedAsset(issueKey);
      const roster = await reader.getRoster();
      const result = failoverIfDue(lease, roster, {
        hazardClass: incident ? incident.hazardClass : 'unknown',
        requiredParts: asset ? asset.requiredParts : [],
      }, now());
      if (result.changed) {
        await w.saveLease(result.lease);
        await w.postReceipt(issueKey,
          'FrontBox standby failover: ' + result.reason + ' Receipt '
          + (result.receipt ? result.receipt.receiptHash : '(none)') + '.');
      }
      return result;
    },

    async sweepFailovers() {
      const leases = await reader.listLeases();
      const results = [];
      for (const lease of leases) {
        results.push(await service.runFailover(lease.issueKey));
      }
      return results;
    },

    async verifyEvidence(issueKey) {
      const record = await reader.getIntakeRecord(issueKey);
      if (!record) {
        return { issueKey, found: false, sealValid: false, claimReady: false, missing: ['No FrontBox intake stored for this incident.'], evidenceHash: null };
      }
      const sealValid = verifySeal(record.sealed, record.evidenceHash);
      const claim = evaluateClaimReady(record.sealed);
      return {
        issueKey,
        found: true,
        sealValid,
        claimReady: claim.ready,
        missing: claim.missing,
        evidenceHash: record.evidenceHash,
        redactions: record.redactions,
      };
    },

    async getDispatchState(issueKey) {
      const ctx = await loadGateContext(issueKey);
      const record = await reader.getIntakeRecord(issueKey);
      const lease = await reader.getLease(issueKey);
      const routing = record ? record.routing : null;
      return {
        incident: ctx.incident,
        asset: ctx.asset,
        sop: ctx.sop,
        crew: ctx.crew,
        gate: ctx.gate,
        routing,
        claim: record ? record.claim : null,
        evidenceHash: record ? record.evidenceHash : null,
        lease,
        spoken: buildSpokenReceipt({ issueKey, gate: ctx.gate, routing, lease }),
      };
    },

    // Citizen-safe view for the portal status panel. No crew ids, no
    // account ids, no hashes beyond the evidence seal the citizen owns.
    async getCitizenStatus(issueKey) {
      const state = await service.getDispatchState(issueKey);
      const crewStatus = !state.lease
        ? 'No crew reserved yet.'
        : state.lease.status === 'ACCEPTED'
          ? 'A crew has accepted and is on the way.'
          : state.lease.status === 'EXHAUSTED'
            ? 'A commander is escalating. No standby crew remains.'
            : 'A crew is reserved. Accept deadline ' + state.lease.acceptBy + '.';
      return {
        issueKey,
        summary: state.incident.summary,
        lane: state.routing ? state.routing.lane : null,
        slaMinutes: state.routing ? state.routing.slaMinutes : null,
        nextAction: state.routing ? state.routing.nextAction : 'Complete the guided portal form so FrontBox can route this report.',
        missing: state.claim ? state.claim.missing : ['Guided intake not submitted yet.'],
        claimReady: state.claim ? state.claim.ready : false,
        gateAllowed: state.gate.allowed,
        statusLine: state.gate.allowed
          ? 'Safety checks pass. Waiting for commander approval or crew accept.'
          : 'Not dispatchable yet: ' + (state.gate.blockedReasons[0] ?? 'a required check is incomplete.'),
        crewStatus,
        evidenceHash: state.evidenceHash,
        spoken: state.spoken,
      };
    },

    async getEvidenceBundle(issueKey) {
      const state = await service.getDispatchState(issueKey);
      return buildEvidenceBundle({
        incident: state.incident,
        evidenceHash: state.evidenceHash,
        gate: state.gate,
        leases: state.lease ? [state.lease] : [],
        routing: state.routing,
        outcome: state.lease && state.lease.status === 'ACCEPTED' ? 'crew-accepted' : 'open',
        now: now(),
      });
    },

    async publishEvidenceBundle(issueKey, { spaceId = '' } = {}) {
      const w = requireWriter();
      const bundle = await service.getEvidenceBundle(issueKey);
      const page = await w.publishEvidencePage(issueKey, {
        spaceId,
        title: 'FrontBox post-incident evidence bundle: ' + issueKey,
        markdown: bundle.markdown,
        bundleId: bundle.bundleId,
      });
      return { bundleId: bundle.bundleId, manifest: bundle.manifest, page };
    },
  };
  return service;
}
