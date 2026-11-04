import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInvokeNames, extractResolverNames, validateFrontendTexts, cleanRoomFindings } from '../scripts/validate-manifest.js';

const RESOLVERS = `
  resolver.define('getDispatchState', async () => {});
  resolver.define('submitIntake', async () => {});
`;

test('extracts invoke and resolver names', () => {
  assert.deepEqual(extractInvokeNames("await invoke('submitIntake', {})"), ['submitIntake']);
  assert.deepEqual(extractResolverNames(RESOLVERS), ['getDispatchState', 'submitIntake']);
});

test('clean frontend passes the contract', () => {
  const failures = validateFrontendTexts({
    resolverNames: extractResolverNames(RESOLVERS),
    frontends: [{
      name: 'panel.jsx',
      text: "import { invoke } from '@forge/bridge';\nconst x = await invoke('getDispatchState', {});\n",
    }],
  });
  assert.deepEqual(failures, []);
});

test('unknown invoke name fails with the typo named', () => {
  const failures = validateFrontendTexts({
    resolverNames: extractResolverNames(RESOLVERS),
    frontends: [{ name: 'panel.jsx', text: "await invoke('getDipatchState', {})" }],
  });
  assert.ok(failures.some((f) => f.includes('getDipatchState')));
});

test('frontend fetch and external URLs fail the Zero Egress contract', () => {
  const failures = validateFrontendTexts({
    resolverNames: [],
    frontends: [{ name: 'bad.jsx', text: "fetch('https://example.com/x')" }],
  });
  assert.ok(failures.some((f) => f.includes('fetch')));
  assert.ok(failures.some((f) => f.includes('external URL')));
});

test('clean-room scan catches filler and em dashes', () => {
  assert.ok(cleanRoomFindings('We leverage a seamless flow').includes('leverage'));
  assert.ok(cleanRoomFindings('a \u2014 b').includes('em-dash'));
  assert.deepEqual(cleanRoomFindings('A short plain sentence.'), []);
});

test('raw HTML elements fail the UI Kit contract', () => {
  const failures = validateFrontendTexts({
    resolverNames: [],
    frontends: [{ name: 'bad.jsx', text: 'const el = <div>hi</div>;' }],
  });
  assert.ok(failures.some((f) => f.includes('HTML')));
});
