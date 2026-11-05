import test from 'node:test';
import assert from 'node:assert/strict';
import { createForgePorts, mapAssetsObject, bundleToStorageHtml, CONFIG_KEY, scopeOf } from '../src/forge/ports.js';
import { seedDemoWorkspace } from '../src/forge/seed.js';

function fakeStore() {
  const data = new Map();
  return {
    data,
    async get(key) { return data.get(key) ?? null; },
    async set(key, value) { data.set(key, value); },
  };
}

const fakeRoute = (strings, ...values) => strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');

function failingApi() {
  const fail = async () => { throw new Error('no live site in tests'); };
  return { asApp: () => ({ requestJira: fail, requestConfluence: fail }), asUser: () => ({ requestTeamworkGraph: fail }) };
}

test('reader falls back to the seeded graph when Jira is unreachable', async () => {
  const store = fakeStore();
  await seedDemoWorkspace(store);
  const { reader } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  const incident = await reader.getIncident('GRID-101');
  assert.equal(incident.source, 'demo-seed');
  const asset = await reader.getLinkedAsset('GRID-101');
  assert.equal(asset.assetKey, 'AST-TRF-4001');
  const sop = await reader.getSafetySop('AST-TRF-4001');
  assert.equal(sop.pageId, 'sop-hv-loto-01');
});

test('writer stores leases with an index and receipts fall back to storage', async () => {
  const store = fakeStore();
  const { reader, writer } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  await writer.saveLease({ leaseId: 'lease-1', issueKey: 'GRID-101', crewId: 'crew-alpha', status: 'RESERVED', history: [] });
  const leases = await reader.listLeases();
  assert.equal(leases.length, 1);
  assert.equal(leases[0].crewId, 'crew-alpha');
  await writer.postReceipt('GRID-101', 'receipt text');
  assert.ok([...store.data.keys()].some((k) => k.startsWith('frontbox:receipt:GRID-101:')));
});

test('Assets object mapping extracts key, name, and required parts', () => {
  const mapped = mapAssetsObject({
    objectKey: 'AST-9',
    label: 'Feeder span',
    attributes: [
      { objectTypeAttribute: { name: 'Required Parts' }, objectAttributeValues: [{ value: 'part-a, part-b' }] },
    ],
  });
  assert.deepEqual(mapped, { assetKey: 'AST-9', name: 'Feeder span', requiredParts: ['part-a', 'part-b'], source: 'jira-assets' });
  assert.equal(mapAssetsObject(null), null);
});

test('live Assets lookup runs only with site config and maps the AQL hit', async () => {
  const store = fakeStore();
  await store.set(CONFIG_KEY, { assetsWorkspaceId: 'ws-1' });
  const calls = [];
  const api = {
    asApp: () => ({
      requestJira: async (path) => {
        calls.push(String(path));
        return {
          ok: true,
          json: async () => ({ values: [{ objectKey: 'AST-LIVE-1', label: 'Live transformer', attributes: [{ objectTypeAttribute: { name: 'Required Parts' }, objectAttributeValues: [{ value: 'fuse-cutout-15kv' }] }] }] }),
        };
      },
    }),
    asUser: () => ({ requestTeamworkGraph: async () => { throw new Error('unused'); } }),
  };
  const { reader } = createForgePorts({ api, store, route: fakeRoute });
  const asset = await reader.getLinkedAsset('GRID-777');
  assert.equal(asset.assetKey, 'AST-LIVE-1');
  assert.ok(calls.some((c) => c.includes('ws-1')));
});

test('without site config the live lookup stays off and returns null', async () => {
  const store = fakeStore();
  const { reader } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  assert.equal(await reader.getLinkedAsset('GRID-777'), null);
  assert.equal(await reader.getSafetySop('AST-UNKNOWN'), null);
});

test('bundle storage HTML escapes citizen text', () => {
  const html = bundleToStorageHtml('# Title\n\n- Line with <script> tag');
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<h1>Title</h1>'));
});

test('publish without a space id stores locally and says why', async () => {
  const store = fakeStore();
  const { writer } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  const result = await writer.publishEvidencePage('GRID-101', { spaceId: '', title: 'Bundle', storageHtml: '<p>x</p>', bundleId: 'sha256:abc' });
  assert.equal(result.published, false);
  assert.ok(result.reason.includes('space'));
  assert.ok([...store.data.keys()].some((k) => k.startsWith('frontbox:bundle:')));
});

test('project-scoped multitenant config and lease index isolate GRID vs ROAD desks', async () => {
  assert.equal(scopeOf('GRID-101'), 'GRID');
  assert.equal(scopeOf('ROAD-201'), 'ROAD');
  const store = fakeStore();
  const { reader, writer } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  await writer.saveConfig({ assetsWorkspaceId: 'ws-grid', evidenceSpaceId: 'SPACE-GRID' }, 'GRID');
  await writer.saveConfig({ assetsWorkspaceId: 'ws-road', evidenceSpaceId: 'SPACE-ROAD' }, 'ROAD');
  const gridCfg = await reader.getConfig('GRID-101');
  const roadCfg = await reader.getConfig('ROAD-201');
  assert.equal(gridCfg.assetsWorkspaceId, 'ws-grid');
  assert.equal(roadCfg.assetsWorkspaceId, 'ws-road');

  await writer.saveLease({ leaseId: 'l-1', issueKey: 'GRID-101', crewId: 'crew-alpha', status: 'RESERVED', history: [] });
  await writer.saveLease({ leaseId: 'l-2', issueKey: 'ROAD-201', crewId: 'crew-delta', status: 'RESERVED', history: [] });
  const gridLeases = await reader.listLeases('GRID');
  const roadLeases = await reader.listLeases('ROAD');
  const allLeases = await reader.listLeases();
  assert.equal(gridLeases.length, 1);
  assert.equal(gridLeases[0].issueKey, 'GRID-101');
  assert.equal(roadLeases.length, 1);
  assert.equal(roadLeases[0].issueKey, 'ROAD-201');
  assert.equal(allLeases.length, 2);
});

test('draft intake correlation binds DRAFT-* portal submission to the created issueKey (Fowler F1)', async () => {
  const store = fakeStore();
  const { reader, writer } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  const draftRecord = { issueKey: 'DRAFT-17000001', routing: { lane: 'P0', slaMinutes: 15 }, evidenceHash: 'sha256:draft1' };
  await writer.saveIntakeRecord('DRAFT-17000001', draftRecord);
  const bound = await writer.bindDraftIntake('DEMO-42');
  assert.equal(bound.issueKey, 'DEMO-42');
  assert.equal(bound.boundFromDraftKey, 'DRAFT-17000001');
  const loaded = await reader.getIntakeRecord('DEMO-42');
  assert.equal(loaded.evidenceHash, 'sha256:draft1');
  assert.equal(await writer.bindDraftIntake('DEMO-43'), null);
});

test('optimistic offline lock rejects stale lease overwrite on same leaseId (Fowler F3)', async () => {
  const store = fakeStore();
  const { writer } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  await writer.saveLease({ leaseId: 'lease-abc', issueKey: 'GRID-101', crewId: 'crew-alpha', status: 'RESERVED', version: 1, history: [] });
  await writer.saveLease({ leaseId: 'lease-abc', issueKey: 'GRID-101', crewId: 'crew-bravo', status: 'RESERVED', version: 2, history: [] });
  await assert.rejects(
    () => writer.saveLease({ leaseId: 'lease-abc', issueKey: 'GRID-101', crewId: 'crew-alpha', status: 'ACCEPTED', version: 2, history: [] }),
    /Optimistic lock conflict/i,
  );
});

test('unseeded non-demo issue does not query seed and seeded records carry source metadata (Fowler F6/F7)', async () => {
  const store = fakeStore();
  await seedDemoWorkspace(store);
  const { reader } = createForgePorts({ api: failingApi(), store, route: fakeRoute });
  assert.equal(await reader.getIncident('PROD-999'), null);
  assert.equal(await reader.getLinkedAsset('PROD-999'), null);
  const demoAsset = await reader.getLinkedAsset('GRID-101');
  assert.equal(demoAsset.source, 'demo-seed');
  assert.equal(demoAsset.degradedReason, 'live-lookup-skipped-or-unavailable');
  const demoSop = await reader.getSafetySop('AST-TRF-4001');
  assert.equal(demoSop.source, 'demo-seed');
});
