import test from 'node:test';
import assert from 'node:assert/strict';
import { sealIntake } from '../src/frontbox/domain/scene-proof.js';
import { evaluateClaimReady } from '../src/frontbox/domain/claim-ready.js';

function sealedFor(intake) {
  return sealIntake(intake).sealed;
}

test('complete utility intake is ready', () => {
  const claim = evaluateClaimReady(sealedFor({
    scenario: 'utility-grid',
    location: 'Maple Row 14',
    description: 'Transformer hum then full outage on the row.',
    photoCount: 1,
    hazardClass: 'high-voltage',
    contactChannel: 'sms',
  }));
  assert.equal(claim.ready, true);
  assert.deepEqual(claim.missing, []);
});

test('missing photo and contact are named, not guessed', () => {
  const claim = evaluateClaimReady(sealedFor({
    scenario: 'utility-grid',
    location: 'Maple Row 14',
    description: 'Transformer hum then full outage on the row.',
    photoCount: 0,
    hazardClass: 'high-voltage',
    contactChannel: '',
  }));
  assert.equal(claim.ready, false);
  assert.ok(claim.missing.includes('At least one scene photo'));
  assert.ok(claim.missing.includes('Callback channel recorded'));
});

test('roadside intake needs the scene diagram', () => {
  const claim = evaluateClaimReady(sealedFor({
    scenario: 'roadside-assist',
    location: 'Route 7 mile 12',
    description: 'Two cars touched bumpers on the shoulder.',
    photoCount: 2,
    hasSceneDiagram: false,
    hazardClass: 'collision',
    contactChannel: 'voice-callback',
  }));
  assert.equal(claim.ready, false);
  assert.ok(claim.missing.includes('SceneProof diagram captured'));
});

test('voice transcript satisfies the narrative rule', () => {
  const claim = evaluateClaimReady(sealedFor({
    scenario: 'utility-grid',
    location: 'Maple Row 14',
    description: '',
    voiceTranscript: 'The pole is humming and our power just went out.',
    photoCount: 1,
    hazardClass: 'outage',
    contactChannel: 'voice-callback',
  }));
  assert.equal(claim.ready, true);
});
