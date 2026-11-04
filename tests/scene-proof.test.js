import test from 'node:test';
import assert from 'node:assert/strict';
import { redactText, sealIntake, verifySeal } from '../src/frontbox/domain/scene-proof.js';

test('redacts email and phone and reports findings', () => {
  const { redacted, findings } = redactText('Call 6901234567 or maria@example.com about the outage');
  assert.equal(redacted.includes('6901234567'), false);
  assert.equal(redacted.includes('maria@example.com'), false);
  assert.ok(findings.some((f) => f.kind === 'email'));
  assert.ok(findings.some((f) => f.kind === 'phone' || f.kind === 'card'));
});

test('seal stores redacted text and verifies by hash', () => {
  const { sealed, evidenceHash } = sealIntake({
    scenario: 'utility-grid',
    location: 'Maple Row 14',
    description: 'Transformer hum. Reach me at nikos@example.org for access.',
    photoCount: 1,
    hazardClass: 'high-voltage',
    contactChannel: 'sms',
  });
  assert.equal(sealed.description.includes('nikos@example.org'), false);
  assert.equal(verifySeal(sealed, evidenceHash), true);
  assert.equal(verifySeal({ ...sealed, location: 'Elsewhere 1' }, evidenceHash), false);
});

test('seal normalizes vulnerable flags to booleans', () => {
  const { sealed } = sealIntake({ description: 'Power out on the row.', vulnerable: { elderly: 'yes' } });
  assert.deepEqual(sealed.vulnerable, {
    disability: false,
    elderly: false,
    medicalDependency: false,
    childAlone: false,
    noAlternativeContact: false,
  });
});
