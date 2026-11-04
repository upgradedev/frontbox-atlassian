import test from 'node:test';
import assert from 'node:assert/strict';
import { sealIntake } from '../src/frontbox/domain/scene-proof.js';
import { routePriority, compareForQueue } from '../src/frontbox/domain/priority-router.js';

function routeFor(intake, waiting = 0) {
  return routePriority(sealIntake(intake).sealed, waiting);
}

test('medical dependency plus high voltage routes P0 with reasons', () => {
  const routing = routeFor({
    description: 'Transformer outage at home with oxygen device.',
    hazardClass: 'high-voltage',
    vulnerable: { medicalDependency: true },
  });
  assert.equal(routing.lane, 'P0');
  assert.equal(routing.slaMinutes, 30);
  assert.ok(routing.reasons.every((r) => typeof r.reason === 'string' && r.reason.length > 0));
});

test('plain property damage routes P2', () => {
  const routing = routeFor({ description: 'Fence panel fell overnight.', hazardClass: 'property-damage' });
  assert.equal(routing.lane, 'P2');
  assert.equal(routing.isVulnerable, false);
});

test('elderly stranded driver outranks fresher low hazard work', () => {
  const elderly = { routing: routeFor({ description: 'Stranded after collision.', hazardClass: 'collision', vulnerable: { elderly: true } }) };
  const plain = { routing: routeFor({ description: 'Fence panel fell overnight.', hazardClass: 'property-damage' }) };
  assert.ok(compareForQueue(elderly, plain) < 0);
});

test('waiting time raises the score inside the same lane logic', () => {
  const fresh = routeFor({ description: 'Street light out on corner.', hazardClass: 'outage' }, 0);
  const waited = routeFor({ description: 'Street light out on corner.', hazardClass: 'outage' }, 120);
  assert.ok(waited.score > fresh.score);
});
