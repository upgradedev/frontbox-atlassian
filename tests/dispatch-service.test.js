import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryPorts,
  createDispatchService,
  demoSeed,
  demoIntake,
  LeastPrivilegeError,
} from '../src/frontbox/index.js';

const NOW = '2026-12-01T09:00:00.000Z';

function makeService(overrides = {}) {
  const ports = createInMemoryPorts(demoSeed());
  const service = createDispatchService({
    reader: ports.reader,
    writer: ports.writer,
    clock: () => overrides.now ?? NOW,
  });
  return { ports, service };
}

test('submitIntake seals, routes, and stores through the Writer', async () => {
  const { ports, service } = makeService();
  const record = await service.submitIntake('GRID-101', demoIntake('GRID-101'));
  assert.equal(record.claim.ready, true);
  assert.equal(record.routing.lane, 'P0');
  assert.equal(ports.store.priorities.get('GRID-101'), 'P0');
});

test('read-only service can verify but cannot reserve (A7)', async () => {
  const ports = createInMemoryPorts(demoSeed());
  const readOnly = createDispatchService({ reader: ports.reader, writer: undefined, clock: () => NOW });
  const verified = await readOnly.verifySafety('GRID-101');
  assert.equal(verified.allowed, true);
  await assert.rejects(
    () => readOnly.reserveCrew('GRID-101', { commanderApproved: true, approvedReceiptHash: verified.receiptHash }),
    LeastPrivilegeError,
  );
});

test('reservation refuses without commander approval', async () => {
  const { service } = makeService();
  const verified = await service.verifySafety('GRID-101');
  await assert.rejects(
    () => service.reserveCrew('GRID-101', { commanderApproved: false, approvedReceiptHash: verified.receiptHash }),
    /commander approval is required/i,
  );
});

test('reservation refuses a stale approval hash', async () => {
  const { service } = makeService();
  await assert.rejects(
    () => service.reserveCrew('GRID-101', { commanderApproved: true, approvedReceiptHash: 'sha256:deadbeef' }),
    /does not match the current dispatch plan/,
  );
});

test('blocked incident cannot be reserved even with approval', async () => {
  const { service } = makeService();
  const verified = await service.verifySafety('GRID-103');
  assert.equal(verified.allowed, false);
  await assert.rejects(
    () => service.reserveCrew('GRID-103', { commanderApproved: true, approvedReceiptHash: verified.receiptHash }),
    /Dispatch blocked/,
  );
});

test('reserve then failover after the deadline end to end', async () => {
  const ports = createInMemoryPorts(demoSeed());
  let current = NOW;
  const service = createDispatchService({ reader: ports.reader, writer: ports.writer, clock: () => current });
  const verified = await service.verifySafety('GRID-101');
  const { lease } = await service.reserveCrew('GRID-101', { commanderApproved: true, approvedReceiptHash: verified.receiptHash });
  assert.equal(lease.crewId, 'crew-alpha');
  current = '2026-12-01T09:16:00.000Z';
  const result = await service.runFailover('GRID-101');
  assert.equal(result.changed, true);
  assert.equal(result.lease.crewId, 'crew-bravo');
  assert.ok(ports.store.receipts.some((r) => r.text.includes('standby failover')));
});

test('evidence bundle id is stable for identical inputs', async () => {
  const { service } = makeService();
  await service.submitIntake('GRID-101', demoIntake('GRID-101'));
  const a = await service.getEvidenceBundle('GRID-101');
  const b = await service.getEvidenceBundle('GRID-101');
  assert.equal(a.bundleId, b.bundleId);
  const evidence = await service.verifyEvidence('GRID-101');
  assert.equal(evidence.sealValid, true);
});
