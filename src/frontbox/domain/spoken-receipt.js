// Aletheia spoken receipts. Every dispatch decision gets a short plain
// sentence set that a screen reader, voice assistant, or Braille display
// can speak as-is. No hashes, no crew internals, no jargon codes beyond
// the priority lane the citizen was already told about.

export function buildSpokenReceipt({ issueKey, gate, routing, lease }) {
  if (!issueKey) throw new TypeError('buildSpokenReceipt requires issueKey');
  const sentences = ['FrontBox update for incident ' + issueKey + '.'];

  if (routing) {
    sentences.push('Your report is priority ' + routing.lane + '. Target response ' + routing.slaMinutes + ' minutes.');
  } else {
    sentences.push('Priority is not assigned yet. Submit the guided portal form to get a lane and a target time.');
  }

  if (!gate) {
    sentences.push('Safety checks have not run yet.');
  } else if (gate.allowed) {
    sentences.push('The safety checks pass. A human commander still approves before any crew sets out.');
  } else {
    const first = gate.blockedReasons?.[0] ?? 'A required check is incomplete.';
    sentences.push('This incident cannot be dispatched yet. First reason: ' + first);
  }

  if (lease?.status === 'RESERVED') {
    sentences.push('A crew is reserved and must accept by ' + lease.acceptBy + '. If they miss that time, the standby crew takes over automatically.');
  } else if (lease?.status === 'ACCEPTED') {
    sentences.push('A crew has accepted and is on the way.');
  } else if (lease?.status === 'EXHAUSTED') {
    sentences.push('No standby crew remains. A commander is escalating this incident now.');
  }

  if (routing?.nextAction) sentences.push('Next step: ' + routing.nextAction);

  const text = sentences.join(' ');
  const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const ssml = '<speak>' + sentences.map((s) => '<s>' + esc(s) + '</s>').join(' <break time="300ms"/> ') + '</speak>';
  return { text, ssml };
}
