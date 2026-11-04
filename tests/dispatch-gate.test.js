import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDispatchGate } from '../src/frontbox/domain/dispatch-gate.js';

const NOW = '2026-12-01T09:00:00.000Z';

function goodInput() {
  return {
    incident: { issueKey: 'GRID-101', hazardClass: 'high-voltage' },
    asset: { assetKey: 'AST-TRF-4001', name: 'Pole transformer', requiredParts: ['fuse-cutout-15kv'] },
    sop: { pageId: 'sop-1', title: 'LOTO', signedByAccountId: 'lead-1', signedAt: '2026-11-01T00:00:00.000Z', validUntil: '2027-03-01T00:00:00.000Z' },
    crew: { crewId: 'crew-alpha', certifications: ['high-voltage'], vanParts: ['fuse-cutout-15kv'] },
    policy: { autoDispatch: false, commanderApproved: true },
    now: NOW,
  };
}

test('fully verified dispatch is allowed', () => {
  const gate = evaluateDispatchGate(goodInput());
  assert.equal(gate.allowed, true);
  assert.deepEqual(gate.blockedReasons, []);
});

test('receipt hash is stable across evaluation time', () => {
  const a = evaluateDispatchGate(goodInput());
  const b = evaluateDispatchGate({ ...goodInput(), now: '2026-12-01T09:05:00.000Z' });
  assert.equal(a.receiptHash, b.receiptHash);
});

test('missing van part blocks with the part named', () => {
  const input = goodInput();
  input.crew = { ...input.crew, vanParts: [] };
  const gate = evaluateDispatchGate(input);
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockedReasons.join(' ').includes('fuse-cutout-15kv'));
});

test('expired SOP sign-off blocks', () => {
  const input = goodInput();
  input.sop = { ...input.sop, validUntil: '2026-01-01T00:00:00.000Z' };
  const gate = evaluateDispatchGate(input);
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockedReasons.join(' ').includes('expired'));
});

test('missing asset fails closed', () => {
  const input = goodInput();
  const gate = evaluateDispatchGate({ ...input, asset: null, sop: null });
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockedReasons.length >= 2);
});

test('high voltage without commander approval blocks on policy', () => {
  const input = goodInput();
  input.policy = { autoDispatch: true, commanderApproved: false };
  const gate = evaluateDispatchGate(input);
  assert.equal(gate.allowed, false);
  assert.ok(gate.blockedReasons.join(' ').includes('Commander approval required'));
});
