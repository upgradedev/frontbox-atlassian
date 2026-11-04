import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCrew, createLease, acceptLease, failoverIfDue } from '../src/frontbox/domain/standby-roster.js';
import { demoSeed } from '../src/frontbox/seed-data.js';

const T0 = '2026-12-01T09:00:00.000Z';
const roster = demoSeed().roster;

test('selects nearest qualified crew carrying every part', () => {
  const crew = selectCrew(roster, { hazardClass: 'high-voltage', requiredParts: ['fuse-cutout-15kv', 'insulator-set-a'] });
  assert.equal(crew.crewId, 'crew-alpha');
});

test('skips crews without the parts even when nearer', () => {
  const crew = selectCrew(roster, { hazardClass: 'high-voltage', requiredParts: ['feeder-splice-kit'] });
  assert.equal(crew.crewId, 'crew-bravo');
});

test('returns null when nobody qualifies', () => {
  const crew = selectCrew(roster, { hazardClass: 'high-voltage', requiredParts: ['gis-switch-module'] });
  assert.equal(crew, null);
});

test('lease accepts inside the window and refuses after it', () => {
  const lease = createLease({ issueKey: 'GRID-101', crew: roster[0], now: T0 });
  const accepted = acceptLease(lease, 'crew-alpha', '2026-12-01T09:10:00.000Z');
  assert.equal(accepted.status, 'ACCEPTED');
  assert.throws(() => acceptLease(lease, 'crew-alpha', '2026-12-01T09:20:00.000Z'), /expired/);
});

test('failover promotes standby after the deadline with a receipt', () => {
  const lease = createLease({ issueKey: 'GRID-101', crew: roster[0], now: T0 });
  const result = failoverIfDue(lease, roster, { hazardClass: 'high-voltage', requiredParts: ['fuse-cutout-15kv'] }, '2026-12-01T09:16:00.000Z');
  assert.equal(result.changed, true);
  assert.equal(result.lease.crewId, 'crew-bravo');
  assert.ok(result.receipt.receiptHash.startsWith('sha256:'));
});

test('failover is a no-op before the deadline', () => {
  const lease = createLease({ issueKey: 'GRID-101', crew: roster[0], now: T0 });
  const result = failoverIfDue(lease, roster, { hazardClass: 'high-voltage', requiredParts: [] }, '2026-12-01T09:05:00.000Z');
  assert.equal(result.changed, false);
});

test('exhausted roster escalates instead of guessing', () => {
  const only = [roster[0]];
  const lease = createLease({ issueKey: 'GRID-101', crew: only[0], now: T0 });
  const result = failoverIfDue(lease, only, { hazardClass: 'high-voltage', requiredParts: [] }, '2026-12-01T09:16:00.000Z');
  assert.equal(result.lease.status, 'EXHAUSTED');
});
