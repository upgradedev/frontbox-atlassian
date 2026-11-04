import { contentHash } from './canonical.js';

// SceneProof: citizen evidence is redacted before it is sealed or stored.
// Fail closed: text that still matches a protected pattern after redaction
// blocks the seal instead of passing through.

const PATTERNS = [
  { kind: 'email', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, token: '[EMAIL]' },
  { kind: 'card', regex: /\b(?:\d[ -]?){13,19}\b/g, token: '[CARD]' },
  { kind: 'iban', regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?\d{1,3})?\b/g, token: '[IBAN]' },
  { kind: 'phone', regex: /(?:\+\d{1,3}[ -]?)?(?:\(?\d{2,4}\)?[ -]?){2,4}\d{3,4}\b/g, token: '[PHONE]' },
  { kind: 'plate', regex: /\b[A-Z]{3}[- ]?\d{4}\b/g, token: '[PLATE]' },
];

export function redactText(text) {
  const findings = [];
  let redacted = String(text ?? '');
  for (const { kind, regex, token } of PATTERNS) {
    const matches = redacted.match(regex);
    if (matches) {
      findings.push({ kind, count: matches.length });
      redacted = redacted.replace(regex, token);
    }
  }
  return { redacted, findings };
}

// A card-shaped run of digits also matches the phone pattern. Card runs
// first so card numbers are never mislabelled, and phone requires grouping.
export function sealIntake(intake) {
  if (!intake || typeof intake !== 'object') {
    throw new TypeError('sealIntake requires an intake object');
  }
  const narrative = redactText(intake.description ?? '');
  const transcript = redactText(intake.voiceTranscript ?? '');
  const sealed = {
    scenario: intake.scenario ?? 'utility-grid',
    location: intake.location ?? '',
    description: narrative.redacted,
    voiceTranscript: transcript.redacted,
    photoCount: Number.isInteger(intake.photoCount) ? intake.photoCount : 0,
    hasSceneDiagram: intake.hasSceneDiagram === true,
    hazardClass: intake.hazardClass ?? 'unknown',
    equipmentHint: intake.equipmentHint ?? '',
    contactChannel: intake.contactChannel ?? '',
    policyRefPresent: Boolean(intake.policyRef),
    vulnerable: normalizeVulnerable(intake.vulnerable),
    capturedAt: intake.capturedAt ?? '',
  };
  const findings = [...narrative.findings, ...transcript.findings];
  for (const { regex } of PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(sealed.description) || regex.test(sealed.voiceTranscript)) {
      throw new Error('SceneProof seal refused: protected data survived redaction');
    }
  }
  return {
    sealed,
    redactions: findings,
    evidenceHash: contentHash(sealed),
  };
}

export function verifySeal(sealed, evidenceHash) {
  return contentHash(sealed) === evidenceHash;
}

function normalizeVulnerable(v) {
  const source = v && typeof v === 'object' ? v : {};
  return {
    disability: source.disability === true,
    elderly: source.elderly === true,
    medicalDependency: source.medicalDependency === true,
    childAlone: source.childAlone === true,
    noAlternativeContact: source.noAlternativeContact === true,
  };
}
