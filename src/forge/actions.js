// Rovo action handlers. The same functions back the Dispatch Commander
// agent and the MCP server tools. Each returns plain JSON the agent can
// quote. Write actions refuse without a verified, approved gate receipt.

export function createActionHandlers(service) {
  async function verifySafetySopAndParts({ payload }) {
    const result = await service.verifySafety(payload.issueKey);
    return {
      issueKey: result.issueKey,
      status: result.allowed ? 'READY_FOR_COMMANDER_APPROVAL' : 'BLOCKED',
      blockedReasons: result.blockedReasons,
      receiptHash: result.receiptHash,
      assetKey: result.assetKey,
      sopPageId: result.sopPageId,
      crewId: result.crewId,
    };
  }

  async function matchAndReserveCrew({ payload }) {
    const verified = await service.verifySafety(payload.issueKey);
    const result = await service.reserveCrew(payload.issueKey, {
      commanderApproved: payload.commanderApproved === true,
      approvedReceiptHash: verified.receiptHash,
    });
    return {
      issueKey: payload.issueKey,
      status: 'RESERVED',
      leaseId: result.lease.leaseId,
      crewId: result.lease.crewId,
      acceptBy: result.lease.acceptBy,
      receiptHash: result.receiptHash,
    };
  }

  async function triggerStandbyFailover({ payload }) {
    const result = await service.runFailover(payload.issueKey);
    return {
      issueKey: payload.issueKey,
      status: result.changed ? 'FAILED_OVER' : 'NOT_DUE',
      reason: result.reason,
      crewId: result.lease ? result.lease.crewId : null,
      receiptHash: result.receipt ? result.receipt.receiptHash : null,
    };
  }

  async function verifySceneProofEvidence({ payload }) {
    const result = await service.verifyEvidence(payload.issueKey);
    return {
      issueKey: result.issueKey,
      status: !result.found ? 'NO_INTAKE' : result.sealValid && result.claimReady ? 'VERIFIED' : 'INCOMPLETE',
      sealValid: result.sealValid,
      claimReady: result.claimReady,
      missing: result.missing,
      evidenceHash: result.evidenceHash,
    };
  }

  return { verifySafetySopAndParts, matchAndReserveCrew, triggerStandbyFailover, verifySceneProofEvidence };
}
