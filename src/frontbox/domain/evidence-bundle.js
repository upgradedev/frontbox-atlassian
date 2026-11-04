import { contentHash } from './canonical.js';

// Post-Incident Evidence Bundle for Confluence. One content address over
// the intake seal, gate receipt, lease history, and outcome. Rebuilding
// the bundle from the same inputs yields the same bundle id.

export function buildEvidenceBundle({ incident, evidenceHash, gate, leases = [], routing, outcome, now }) {
  if (!incident || !incident.issueKey) {
    throw new TypeError('buildEvidenceBundle requires incident.issueKey');
  }
  const manifest = {
    issueKey: incident.issueKey,
    summary: incident.summary ?? '',
    hazardClass: incident.hazardClass ?? 'unknown',
    evidenceHash: evidenceHash ?? null,
    gateReceiptHash: gate ? gate.receiptHash : null,
    gateAllowed: gate ? gate.allowed === true : null,
    priorityLane: routing ? routing.lane : null,
    leaseHistory: leases.flatMap((lease) => lease.history.map((h) => ({ leaseId: lease.leaseId, ...h }))),
    outcome: outcome ?? 'open',
    builtAt: now ?? null,
  };
  const bundleId = contentHash(manifest);
  const lines = [
    '# FrontBox post-incident evidence bundle: ' + manifest.issueKey,
    '',
    '- Summary: ' + (manifest.summary || '(none recorded)'),
    '- Hazard class: ' + manifest.hazardClass,
    '- Priority lane: ' + (manifest.priorityLane ?? 'not routed'),
    '- Outcome: ' + manifest.outcome,
    '- SceneProof evidence hash: ' + (manifest.evidenceHash ?? 'missing'),
    '- Dispatch gate receipt: ' + (manifest.gateReceiptHash ?? 'missing'),
    '- Gate allowed dispatch: ' + (manifest.gateAllowed === null ? 'not evaluated' : String(manifest.gateAllowed)),
    '- Bundle id: ' + bundleId,
    '',
    '## Standby lease history',
    '',
    ...(manifest.leaseHistory.length === 0
      ? ['No crew lease recorded.']
      : manifest.leaseHistory.map((h) => '- ' + h.at + ' ' + h.event + ' crew ' + h.crewId + ' (lease ' + h.leaseId + ')')),
    '',
    '## Verification',
    '',
    'Rebuild this bundle from the JSM incident to check the bundle id.',
    'Any changed input changes the id. That is the integrity check.',
  ];
  return { bundleId, manifest, markdown: lines.join('\n') };
}
