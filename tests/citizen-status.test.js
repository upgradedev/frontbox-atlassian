import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryPorts, createDispatchService, demoSeed, demoIntake, buildSpokenReceipt } from '../src/frontbox/index.js';

const NOW = '2026-12-01T09:00:00.000Z';

function makeService() {
  const ports = createInMemoryPorts(demoSeed());
  const service = createDispatchService({ reader: ports.reader, writer: ports.writer, clock: () => NOW });
  return { ports, service };
}

test('spoken receipt names lane, gate outcome, and next step in plain words', () => {
  const spoken = buildSpokenReceipt({
    issueKey: 'GRID-101',
    gate: { allowed: true, blockedReasons: [], receiptHash: 'sha256:abc123' },
    routing: { lane: 'P0', slaMinutes: 30, nextAction: 'Dispatch first available verified crew and call the citizen now.' },
    lease: { crewId: 'crew-alpha', status: 'RESERVED', acceptBy: '2026-12-01T09:15:00.000Z' },
  });
  assert.ok(spoken.text.includes('GRID-101'));
  assert.ok(spoken.text.includes('priority P0'));
  assert.ok(spoken.text.includes('safety checks pass'));
  assert.ok(spoken.ssml.startsWith('<speak>'));
  assert.ok(spoken.ssml.endsWith('</speak>'));
  assert.equal(spoken.text.includes('sha256'), false);
});

test('spoken receipt for a blocked dispatch lists the first reason only', () => {
  const spoken = buildSpokenReceipt({
    issueKey: 'GRID-104',
    gate: { allowed: false, blockedReasons: ['Required spare parts on the crew van: Missing: gis-switch-module.', 'Second reason.'], receiptHash: 'sha256:zzz' },
    routing: null,
    lease: null,
  });
  assert.ok(spoken.text.includes('cannot be dispatched yet'));
  assert.ok(spoken.text.includes('gis-switch-module'));
  assert.equal(spoken.text.includes('Second reason'), false);
});

test('citizen status hides crew internals and shows missing evidence', async () => {
  const { service } = makeService();
  await service.submitIntake('GRID-101', {
    ...demoIntake('GRID-101'),
    photoCount: 0,
  });
  const status = await service.getCitizenStatus('GRID-101');
  assert.equal(status.issueKey, 'GRID-101');
  assert.equal(status.lane, 'P0');
  assert.ok(status.missing.includes('At least one scene photo'));
  assert.equal(JSON.stringify(status).includes('accountId'), false);
  assert.equal(JSON.stringify(status).includes('crew-alpha'), false);
  assert.ok(status.spoken.text.length > 20);
});

test('dispatch state carries the spoken receipt for panels', async () => {
  const { service } = makeService();
  await service.submitIntake('ROAD-201', demoIntake('ROAD-201'));
  const state = await service.getDispatchState('ROAD-201');
  assert.ok(state.spoken.text.includes('ROAD-201'));
});
