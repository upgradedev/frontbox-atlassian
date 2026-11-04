import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/forge/app.js';
import { seedDemoWorkspace } from '../src/forge/seed.js';
import { demoIntake } from '../src/frontbox/index.js';
import { createDemoServer } from './demo-mirror.js';

// Full judge-journey UAT against production wiring (fake Forge runtime)
// plus the live mirror over HTTP. Every step prints PASS or FAIL with
// evidence. Exit 1 on any failure. Run: node scripts/uat.js

class FakeResolver {
  constructor() { this.defs = new Map(); }
  define(name, fn) { this.defs.set(name, fn); }
  getDefinitions() { return Object.fromEntries(this.defs); }
}
const fakeRoute = (strings, ...values) => strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');
const failingApi = {
  asApp: () => ({ requestJira: async () => { throw new Error('UAT seed mode'); }, requestConfluence: async () => { throw new Error('UAT seed mode'); } }),
  asUser: () => ({ requestTeamworkGraph: async () => { throw new Error('UAT seed mode'); } }),
};

const results = [];
function step(id, label, ok, evidence) {
  results.push({ id, ok });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + id + ' ' + label + ' :: ' + evidence);
}

let now = '2026-12-01T09:00:00.000Z';
const data = new Map();
const store = { async get(k) { return data.get(k) ?? null; }, async set(k, v) { data.set(k, v); } };
await seedDemoWorkspace(store);
const app = createApp({ api: failingApi, store, route: fakeRoute, Resolver: FakeResolver, clock: () => now });
const defs = app.handler;
const svc = app.service;

// U1 citizen intake complete
const intake = await defs.submitIntake({ payload: { issueKey: 'GRID-101', intake: demoIntake('GRID-101') } });
step('U1', 'guided intake seals and routes P0', intake.ready === true && intake.lane === 'P0', 'lane=' + intake.lane + ' hash=' + String(intake.evidenceHash).slice(0, 18));

// U2 incomplete intake names the gap
const incomplete = await defs.submitIntake({ payload: { issueKey: 'GRID-102', intake: { ...demoIntake('GRID-101'), photoCount: 0, contactChannel: '' } } });
step('U2', 'ClaimReady names missing evidence', incomplete.ready === false && incomplete.missing.length >= 2, 'missing=' + incomplete.missing.join(' | '));

// U3 gate trio
const v101 = await app.verifySafetySopAndParts({ payload: { issueKey: 'GRID-101' } });
const v103 = await app.verifySafetySopAndParts({ payload: { issueKey: 'GRID-103' } });
const v104 = await app.verifySafetySopAndParts({ payload: { issueKey: 'GRID-104' } });
step('U3', 'gate: ready vs expired SOP vs missing part',
  v101.status !== 'BLOCKED' && v103.status === 'BLOCKED' && v104.status === 'BLOCKED',
  '101=' + v101.status + ' 103=' + v103.blockedReasons.join(' ') + ' 104=' + v104.blockedReasons.join(' '));

// U4 approval refusals
let refusedStale = false;
try { await svc.reserveCrew('GRID-101', { commanderApproved: true, approvedReceiptHash: 'sha256:stale' }); } catch { refusedStale = true; }
let refusedNoApproval = false;
try { await app.matchAndReserveCrew({ payload: { issueKey: 'GRID-101', commanderApproved: false } }); } catch { refusedNoApproval = true; }
step('U4', 'stale hash and missing approval both refused', refusedStale && refusedNoApproval, 'stale=' + refusedStale + ' noApproval=' + refusedNoApproval);

// U5 reserve + failover
const reserved = await app.matchAndReserveCrew({ payload: { issueKey: 'GRID-101', commanderApproved: true } });
now = '2026-12-01T09:16:00.000Z';
const failed = await app.triggerStandbyFailover({ payload: { issueKey: 'GRID-101' } });
step('U5', 'reserve then standby failover promotes next crew',
  reserved.status === 'RESERVED' && failed.status === 'FAILED_OVER' && failed.crewId === 'crew-bravo',
  'reserved=' + reserved.crewId + ' failedOverTo=' + failed.crewId);

// U6 citizen privacy + spoken
const status = await defs.getCitizenStatus({ payload: { issueKey: 'GRID-101' } });
const statusJson = JSON.stringify(status);
step('U6', 'citizen status hides internals, spoken has no hash',
  !statusJson.includes('crew-bravo') && !statusJson.includes('accountId') && !status.spoken.text.includes('sha256'),
  'lane=' + status.lane + ' crewStatus=' + status.crewStatus);

// U7 evidence verify + bundle publish (stored-only without space)
const evidence = await app.verifySceneProofEvidence({ payload: { issueKey: 'GRID-101' } });
const published = await defs.publishEvidenceBundle({ payload: { issueKey: 'GRID-101', spaceId: '' } });
step('U7', 'evidence verifies, bundle publishes stored-only with reason',
  evidence.status === 'VERIFIED' && published.page.published === false && String(published.bundleId).startsWith('sha256:'),
  'evidence=' + evidence.status + ' bundle=' + String(published.bundleId).slice(0, 18));

// U8 triage trigger posts receipt fallback
const triage = await app.triageOnCreate({ issue: { key: 'GRID-103' } });
step('U8', 'issue-created trigger triages and receipts', triage.gateAllowed === false && triage.receiptPosted === true, 'receiptHash=' + String(triage.receiptHash).slice(0, 18));

// U9 mirror over HTTP
const server = await createDemoServer();
await new Promise((resolve) => server.listen(0, resolve));
try {
  const base = 'http://127.0.0.1:' + server.address().port;
  const health = await fetch(base + '/healthz');
  const board = await (await fetch(base + '/')).text();
  const citizen = await (await fetch(base + '/api/status/ROAD-201')).json();
  step('U9', 'mirror HTTP: health, board blocks, citizen JSON',
    health.status === 200 && board.includes('blocked') && citizen.lane === 'P0',
    'health=' + health.status + ' roadLane=' + citizen.lane);
} finally {
  server.close();
}

const failedCount = results.filter((r) => !r.ok).length;
console.log('uat: ' + (results.length - failedCount) + '/' + results.length + ' PASS');
if (failedCount > 0) process.exitCode = 1;
