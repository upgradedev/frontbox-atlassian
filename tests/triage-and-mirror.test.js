import test from 'node:test';
import assert from 'node:assert/strict';
import { pairScore, correlate } from '../src/frontbox/domain/triage.js';
import { createDemoServer } from '../scripts/demo-mirror.js';

test('same outage reports score over the correlation threshold', () => {
  const score = pairScore(
    { assetKey: 'AST-1', geoCell: 'c1', hazardClass: 'outage', summary: 'power out transformer bang' },
    { assetKey: 'AST-1', geoCell: 'c1', hazardClass: 'outage', summary: 'no power loud bang' },
  );
  assert.ok(score >= 0.6);
});

test('unrelated reports stay in separate clusters', () => {
  const clusters = correlate([
    { assetKey: 'AST-1', geoCell: 'c1', hazardClass: 'outage', summary: 'power out on row' },
    { assetKey: 'AST-2', geoCell: 'c9', hazardClass: 'breakdown', summary: 'car stalled at market' },
  ]);
  assert.equal(clusters.length, 2);
});

test('demo mirror serves health, board, and incident JSON', async () => {
  const server = await createDemoServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const health = await fetch(base + '/healthz');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.ok(String(health.headers.get('content-security-policy')).includes("default-src 'none'"));
    assert.equal(await health.text(), 'ok');
    const board = await fetch(base + '/');
    assert.equal(board.status, 200);
    const html = await board.text();
    assert.ok(html.includes('GRID-103'));
    assert.ok(html.includes('blocked'));
    const api = await fetch(base + '/api/incidents/GRID-101');
    const body = await api.json();
    assert.equal(body.gate.allowed, true);
    const statusRes = await fetch(base + '/api/status/GRID-101');
    const status = await statusRes.json();
    assert.equal(status.lane, 'P0');
    assert.equal(JSON.stringify(status).includes('crew-alpha'), false);
    const missing = await fetch(base + '/api/incidents/GRID-999');
    assert.equal(missing.status, 404);
  } finally {
    server.close();
  }
});
