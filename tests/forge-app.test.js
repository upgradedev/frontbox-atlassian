import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/forge/app.js';
import { seedDemoWorkspace } from '../src/forge/seed.js';

class FakeResolver {
  constructor() { this.defs = new Map(); }
  define(name, fn) { this.defs.set(name, fn); }
  getDefinitions() { return Object.fromEntries(this.defs); }
}
const fakeRoute = (strings, ...values) => strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');
const failingApi = {
  asApp: () => ({ requestJira: async () => { throw new Error('seed only'); }, requestConfluence: async () => { throw new Error('seed only'); } }),
  asUser: () => ({ requestTeamworkGraph: async () => { throw new Error('seed only'); } }),
};

async function makeApp() {
  const data = new Map();
  const store = { async get(k) { return data.get(k) ?? null; }, async set(k, v) { data.set(k, v); } };
  await seedDemoWorkspace(store);
  return createApp({ api: failingApi, store, route: fakeRoute, Resolver: FakeResolver, clock: () => '2026-12-01T09:00:00.000Z' });
}

test('app factory exposes every manifest handler name', async () => {
  const app = await makeApp();
  for (const name of ['handler', 'verifySafetySopAndParts', 'matchAndReserveCrew', 'triggerStandbyFailover', 'verifySceneProofEvidence', 'triageOnCreate', 'failoverSweep']) {
    assert.ok(app[name] !== undefined, name);
  }
});

test('app factory tolerates default-wrapped Forge singletons', async () => {
  const data = new Map();
  const store = { async get(k) { return data.get(k) ?? null; }, async set(k, v) { data.set(k, v); } };
  await seedDemoWorkspace(store);
  const app = createApp({
    api: { default: failingApi },
    store: { default: store },
    route: fakeRoute,
    Resolver: { default: FakeResolver },
    clock: () => '2026-12-01T09:00:00.000Z',
  });
  const verified = await app.verifySafetySopAndParts({ payload: { issueKey: 'GRID-101' } });
  assert.equal(verified.status, 'READY_FOR_COMMANDER_APPROVAL');
});

test('full judge flow through production wiring fakes', async () => {
  const app = await makeApp();
  const triage = await app.triageOnCreate({ issue: { key: 'GRID-104' } });
  assert.equal(triage.gateAllowed, false);
  const verified = await app.verifySafetySopAndParts({ payload: { issueKey: 'GRID-101' } });
  assert.equal(verified.status, 'READY_FOR_COMMANDER_APPROVAL');
  const reserved = await app.matchAndReserveCrew({ payload: { issueKey: 'GRID-101', commanderApproved: true } });
  assert.equal(reserved.status, 'RESERVED');
  const sweep = await app.failoverSweep();
  assert.equal(sweep.checked, 1);
  assert.equal(sweep.failedOver, 0);
  const evidence = await app.verifySceneProofEvidence({ payload: { issueKey: 'GRID-101' } });
  assert.equal(evidence.status, 'NO_INTAKE');
});
