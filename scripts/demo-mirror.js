import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInMemoryPorts, createDispatchService, demoSeed, demoIntake } from '../src/frontbox/index.js';
import { esc, chip, renderBoardPage, buildScenariosPayload } from './board-html.js';

// Anonymous judge mirror. Same dispatch service as the Forge app, seeded
// demo graph, zero accounts. Host this file anywhere static Node runs.
// The Forge install remains the product; this mirror proves the core.

const SCRIPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mirror-app.js');

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-embedder-policy': 'require-corp',
  'cross-origin-resource-policy': 'same-origin',
  'cache-control': 'no-store',
};

export async function createDemoServer() {
  const ports = createInMemoryPorts(demoSeed());
  const service = createDispatchService({
    reader: ports.reader,
    writer: ports.writer,
    clock: () => new Date().toISOString(),
  });
  await service.submitIntake('GRID-101', demoIntake('GRID-101'));
  await service.submitIntake('ROAD-201', demoIntake('ROAD-201'));

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/healthz') {
        res.writeHead(200, { 'content-type': 'text/plain', ...SECURITY_HEADERS });
        res.end('ok');
        return;
      }
      if (url.pathname === '/mirror-app.js') {
        const js = await readFile(SCRIPT_PATH, 'utf8');
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', ...SECURITY_HEADERS });
        res.end(js);
        return;
      }
      if (url.pathname === '/api/scenarios.json') {
        const keys = ['GRID-101', 'GRID-102', 'GRID-103', 'GRID-104', 'ROAD-201'];
        const roster = await ports.reader.getRoster();
        const scenarios = await buildScenariosPayload(service, keys, roster);
        res.writeHead(200, { 'content-type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify(scenarios, null, 2));
        return;
      }
      const apiMatch = url.pathname.match(/^\/api\/incidents\/([A-Z]+-\d+)$/);
      if (apiMatch) {
        const state = await service.getDispatchState(apiMatch[1]).catch(() => null);
        res.writeHead(state ? 200 : 404, { 'content-type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify(state ?? { error: 'unknown incident' }, null, 2));
        return;
      }
      const statusMatch = url.pathname.match(/^\/api\/status\/([A-Z]+-\d+)$/);
      if (statusMatch) {
        const status = await service.getCitizenStatus(statusMatch[1]).catch(() => null);
        res.writeHead(status ? 200 : 404, { 'content-type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify(status ?? { error: 'unknown incident' }, null, 2));
        return;
      }
      if (url.pathname === '/') {
        const keys = ['GRID-101', 'GRID-102', 'GRID-103', 'GRID-104', 'ROAD-201'];
        const rows = [];
        for (const key of keys) {
          const state = await service.getDispatchState(key);
          rows.push([
            '<a href="api/incidents/' + key + '">' + esc(key) + '</a>',
            esc(state.incident.summary),
            state.gate.allowed ? chip('ready for commander approval', 'ready') : chip('blocked', 'blocked'),
            esc(state.gate.blockedReasons.join(' ') || 'none'),
            esc(state.routing ? state.routing.lane : 'no intake yet'),
            '<a href="api/status/' + key + '">citizen view</a>',
          ]);
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS });
        res.end(renderBoardPage({
          note: 'Synthetic seeded data. GRID-103 blocks on an expired SOP sign-off. GRID-104 blocks on a missing van part. This mirror proves the dispatch core only. The Forge install is the product.',
          columns: ['Incident', 'Summary', 'Gate', 'Blocked reasons', 'Priority', 'Citizen'],
          rows,
        }));
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain', ...SECURITY_HEADERS });
      res.end('not found');
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain', ...SECURITY_HEADERS });
      res.end('demo mirror error');
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4321);
  const server = await createDemoServer();
  server.listen(port, () => {
    console.log('FrontBox demo mirror on http://localhost:' + port);
  });
}
