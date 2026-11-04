// Product trigger: a new JSM incident is triaged without anyone asking.
// The receipt comment names the gate status and priority lane so the
// dispatcher sees FrontBox output on the surface already open (JSM).

export function createTriggers({ service, writer }) {
  async function triageOnCreate(event) {
    const issueKey = event?.issue?.key;
    if (!issueKey) return { skipped: true, reason: 'Event carried no issue key.' };
    const state = await service.getDispatchState(issueKey).catch(() => null);
    if (!state) return { skipped: true, reason: 'Incident ' + issueKey + ' not visible to FrontBox yet.' };
    const lane = state.routing ? state.routing.lane : 'unrouted (no guided intake yet)';
    const text = state.gate.allowed
      ? 'FrontBox triage: dispatch gate passes for ' + issueKey + '. Priority lane ' + lane + '. Gate receipt ' + state.gate.receiptHash + '. Commander approval still required before any crew rolls.'
      : 'FrontBox triage: dispatch BLOCKED for ' + issueKey + '. Priority lane ' + lane + '. Reasons: ' + state.gate.blockedReasons.join(' ') + ' Gate receipt ' + state.gate.receiptHash + '.';
    if (writer) await writer.postReceipt(issueKey, text);
    return {
      issueKey,
      gateAllowed: state.gate.allowed,
      blockedReasons: state.gate.blockedReasons,
      receiptHash: state.gate.receiptHash,
      receiptPosted: Boolean(writer),
    };
  }

  async function failoverSweep() {
    const results = await service.sweepFailovers();
    return {
      checked: results.length,
      failedOver: results.filter((r) => r.changed).length,
    };
  }

  return { triageOnCreate, failoverSweep };
}
