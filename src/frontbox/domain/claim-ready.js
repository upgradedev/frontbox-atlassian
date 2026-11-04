// ClaimReady: deterministic completeness gate for a sealed intake.
// Missing evidence is named, never guessed. Unknown scenario fails closed
// to the strictest shared rule set.

const RULES = {
  'utility-grid': [
    { id: 'location', label: 'Outage location', ok: (s) => s.location.trim().length >= 3 },
    { id: 'hazard', label: 'Hazard class is known', ok: (s) => s.hazardClass !== 'unknown' && s.hazardClass !== '' },
    { id: 'photo', label: 'At least one scene photo', ok: (s) => s.photoCount >= 1 },
    { id: 'contact', label: 'Callback channel recorded', ok: (s) => s.contactChannel.trim() !== '' },
    { id: 'narrative', label: 'Damage or outage description', ok: (s) => s.description.trim().length >= 10 || s.voiceTranscript.trim().length >= 10 },
  ],
  'roadside-assist': [
    { id: 'location', label: 'Stranding location', ok: (s) => s.location.trim().length >= 3 },
    { id: 'photos', label: 'At least two scene photos', ok: (s) => s.photoCount >= 2 },
    { id: 'diagram', label: 'SceneProof diagram captured', ok: (s) => s.hasSceneDiagram === true },
    { id: 'contact', label: 'Callback channel recorded', ok: (s) => s.contactChannel.trim() !== '' },
    { id: 'narrative', label: 'Incident description', ok: (s) => s.description.trim().length >= 10 || s.voiceTranscript.trim().length >= 10 },
  ],
  'insurance-claims': [
    { id: 'location', label: 'Property location', ok: (s) => s.location.trim().length >= 3 },
    { id: 'photo', label: 'At least one damage photo', ok: (s) => s.photoCount >= 1 },
    { id: 'policy', label: 'Policy reference present', ok: (s) => s.policyRefPresent === true },
    { id: 'contact', label: 'Callback channel recorded', ok: (s) => s.contactChannel.trim() !== '' },
    { id: 'narrative', label: 'Loss description', ok: (s) => s.description.trim().length >= 10 || s.voiceTranscript.trim().length >= 10 },
  ],
};

export function evaluateClaimReady(sealed) {
  const rules = RULES[sealed.scenario] ?? RULES['utility-grid'];
  const checks = rules.map((rule) => ({ id: rule.id, label: rule.label, ok: rule.ok(sealed) }));
  const missing = checks.filter((check) => !check.ok).map((check) => check.label);
  return {
    scenario: sealed.scenario,
    ready: missing.length === 0,
    missing,
    checks,
  };
}

export const SCENARIOS = Object.keys(RULES);
