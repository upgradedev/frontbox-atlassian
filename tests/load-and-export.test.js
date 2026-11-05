import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runLoadSmoke } from '../scripts/load-smoke.js';
import { exportMirror } from '../scripts/export-mirror.js';

test('load smoke replays seeded incidents inside budget', async () => {
  const result = await runLoadSmoke(4);
  assert.equal(result.checks, 20);
  assert.ok(result.blocked >= 8);
  assert.ok(result.perCheckMs < 20);
});

test('static export writes a linked board and per-incident JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontbox-export-'));
  const result = await exportMirror(dir);
  assert.equal(result.files, 11);
  const html = await readFile(path.join(dir, 'index.html'), 'utf8');
  assert.ok(html.includes('GRID-104'));
  assert.ok(html.includes('table-wrap'));
  assert.ok(html.includes('api/GRID-101-status.json'));
  const status = JSON.parse(await readFile(path.join(dir, 'api/GRID-101-status.json'), 'utf8'));
  assert.equal(status.lane, 'P0');
});
