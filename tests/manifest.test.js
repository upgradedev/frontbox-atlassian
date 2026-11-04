import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateManifestText } from '../scripts/validate-manifest.js';

const root = path.resolve(import.meta.dirname, '..');
const manifest = await readFile(path.join(root, 'manifest.yml'), 'utf8');

test('shipped manifest passes the Zero Egress and pairing gate', () => {
  const result = validateManifestText(manifest);
  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
});

test('gate fails when an egress allow-list is added', () => {
  const broken = manifest + '\npermissions:\n  external:\n    fetch:\n      backend:\n        - example.com\n';
  const result = validateManifestText(broken);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes('Zero Egress')));
});

test('gate fails when the MCP pairing is removed', () => {
  const broken = manifest.replaceAll('frontbox-dispatch-mcp-server', 'renamed-server');
  const result = validateManifestText(broken);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes('frontbox-dispatch-mcp-server')));
});

test('gate fails when an action drops out of the agent tool list', () => {
  const broken = manifest.replace('        - trigger-standby-failover\n        - verify-scene-proof-evidence\n  # MCP server surface', '        - verify-scene-proof-evidence\n  # MCP server surface');
  assert.notEqual(broken, manifest);
  const result = validateManifestText(broken);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes('trigger-standby-failover')));
});
