import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryPorts, createDispatchService, demoSeed, demoIntake } from '../src/frontbox/index.js';
import { createActionHandlers } from '../src/forge/actions.js';
import { createTriggers } from '../src/forge/triggers.js';
import { createResolver } from '../src/forge/resolvers.js';
import { fetchLinkedObjects, pickSopPage } from '../src/forge/team-graph.js';

const NOW = '2026-12-01T09:00:00.000Z';

function makeService(clock = () => NOW) {
  const ports = createInMemoryPorts(demoSeed());
  const service = createDispatchService({ reader: ports.reader, writer: ports.writer, clock });
  return { ports, service };
}

test('verify action reports blocked reasons verbatim for expired SOP', async () => {
  const { service } = makeService();
  const actions = createActionHandlers(service);
  const result = await actions.verifySafetySopAndParts({ payload: { issueKey: 'GRID-103' } });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockedReasons.join(' ').includes('expired'));
});

test('reserve action refuses without commander approval', async () => {
  const { service } = makeService();
  const actions = createActionHandlers(service);
  await assert.rejects(
    () => actions.matchAndReserveCrew({ payload: { issueKey: 'GRID-101', commanderApproved: false } }),
    /commander approval/i,
  );
});

test('evidence action verifies a sealed intake end to end', async () => {
  const { service } = makeService();
  await service.submitIntake('GRID-101', demoIntake('GRID-101'));
  const actions = createActionHandlers(service);
  const result = await actions.verifySceneProofEvidence({ payload: { issueKey: 'GRID-101' } });
  assert.equal(result.status, 'VERIFIED');
  const missing = await actions.verifySceneProofEvidence({ payload: { issueKey: 'GRID-102' } });
  assert.equal(missing.status, 'NO_INTAKE');
});

test('issue-created trigger posts a triage receipt', async () => {
  const { ports, service } = makeService();
  const triggers = createTriggers({ service, writer: ports.writer });
  const result = await triggers.triageOnCreate({ issue: { key: 'GRID-104' } });
  assert.equal(result.gateAllowed, false);
  assert.equal(result.receiptPosted, true);
  assert.ok(ports.store.receipts.some((r) => r.text.includes('dispatch BLOCKED')));
  const skipped = await triggers.triageOnCreate({});
  assert.equal(skipped.skipped, true);
});

test('resolver definitions register through an injected Resolver class', async () => {
  class FakeResolver {
    constructor() { this.defs = new Map(); }
    define(name, fn) { this.defs.set(name, fn); }
    getDefinitions() { return Object.fromEntries(this.defs); }
  }
  const { service } = makeService();
  const store = { data: new Map(), async get(k) { return this.data.get(k) ?? null; }, async set(k, v) { this.data.set(k, v); } };
  const resolver = createResolver({ service, store, Resolver: FakeResolver });
  const defs = resolver.getDefinitions();
  for (const name of ['getDispatchState', 'submitIntake', 'seedDemo', 'approveAndReserve', 'runFailover', 'getEvidenceBundle', 'publishEvidenceBundle']) {
    assert.equal(typeof defs[name], 'function', name);
  }
  const state = await defs.getDispatchState({ payload: { issueKey: 'GRID-101' } });
  assert.equal(state.gate.allowed, true);
});

test('publish flow returns a stored-only result without a space id', async () => {
  const { ports, service } = makeService();
  await service.submitIntake('GRID-101', demoIntake('GRID-101'));
  const result = await service.publishEvidenceBundle('GRID-101', { spaceId: '' });
  assert.ok(result.bundleId.startsWith('sha256:'));
  assert.equal(result.page.published, false);
  assert.equal(ports.store.publishedPages.length, 1);
});

test('reserve and failover actions complete the standby story', async () => {
  let current = NOW;
  const { service } = makeService(() => current);
  const actions = createActionHandlers(service);
  const reserved = await actions.matchAndReserveCrew({ payload: { issueKey: 'GRID-101', commanderApproved: true } });
  assert.equal(reserved.status, 'RESERVED');
  assert.equal(reserved.crewId, 'crew-alpha');
  const early = await actions.triggerStandbyFailover({ payload: { issueKey: 'GRID-101' } });
  assert.equal(early.status, 'NOT_DUE');
  current = '2026-12-01T09:16:00.000Z';
  const failedOver = await actions.triggerStandbyFailover({ payload: { issueKey: 'GRID-101' } });
  assert.equal(failedOver.status, 'FAILED_OVER');
  assert.equal(failedOver.crewId, 'crew-bravo');
  assert.ok(failedOver.receiptHash.startsWith('sha256:'));
});

test('resolver definitions drive intake, reserve, failover, and publish', async () => {
  class FakeResolver {
    constructor() { this.defs = new Map(); }
    define(name, fn) { this.defs.set(name, fn); }
    getDefinitions() { return Object.fromEntries(this.defs); }
  }
  let current = NOW;
  const { service } = makeService(() => current);
  const store = { data: new Map(), async get(k) { return this.data.get(k) ?? null; }, async set(k, v) { this.data.set(k, v); } };
  const defs = createResolver({ service, store, Resolver: FakeResolver }).getDefinitions();
  const seeded = await defs.seedDemo({ payload: {} });
  assert.equal(seeded.seeded, true);
  const intake = await defs.submitIntake({ payload: { issueKey: 'GRID-101', intake: demoIntake('GRID-101') } });
  assert.equal(intake.ready, true);
  const state = await defs.getDispatchState({ payload: { issueKey: 'GRID-101' } });
  const reserved = await defs.approveAndReserve({ payload: { issueKey: 'GRID-101', commanderApproved: true, approvedReceiptHash: state.gate.receiptHash } });
  assert.equal(reserved.lease.crewId, 'crew-alpha');
  current = '2026-12-01T09:16:00.000Z';
  const failover = await defs.runFailover({ payload: { issueKey: 'GRID-101' } });
  assert.equal(failover.changed, true);
  const published = await defs.publishEvidenceBundle({ payload: { issueKey: 'GRID-101', spaceId: '' } });
  assert.equal(published.page.published, false);
});

test('resolver accepts a default-wrapped Resolver class (bundler interop)', async () => {
  class FakeResolver {
    constructor() { this.defs = new Map(); }
    define(name, fn) { this.defs.set(name, fn); }
    getDefinitions() { return Object.fromEntries(this.defs); }
  }
  const { service } = makeService();
  const store = { data: new Map(), async get(k) { return this.data.get(k) ?? null; }, async set(k, v) { this.data.set(k, v); } };
  const resolver = createResolver({ service, store, Resolver: { default: FakeResolver } });
  assert.equal(typeof resolver.getDefinitions().getCitizenStatus, 'function');
});

test('graph fetch degrades to null on API failure and picks SOP pages', async () => {
  const badApi = { asUser: () => ({ requestTeamworkGraph: async () => { throw new Error('down'); } }) };
  assert.equal(await fetchLinkedObjects(badApi, 'ari:cloud:jira::issue/1'), null);
  assert.equal(await fetchLinkedObjects(badApi, null), null);
  const sop = pickSopPage([{ type: 'ConfluencePage', id: 'n1', data: { id: 'page-9', title: 'LOTO' } }]);
  assert.deepEqual(sop, { pageId: 'page-9', title: 'LOTO' });
  assert.equal(pickSopPage([]), null);
});
