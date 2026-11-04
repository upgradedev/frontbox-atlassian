import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInMemoryPorts, createDispatchService, demoSeed, demoIntake } from '../src/frontbox/index.js';

// Anonymous judge mirror. Same dispatch service as the Forge app, seeded
// demo graph, zero accounts. Host this file anywhere static Node runs.
// The Forge install remains the product; this mirror proves the core.

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
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok');
        return;
      }
      const apiMatch = url.pathname.match(/^\/api\/incidents\/([A-Z]+-\d+)$/);
      if (apiMatch) {
        const state = await service.getDispatchState(apiMatch[1]).catch(() => null);
        res.writeHead(state ? 200 : 404, { 'content-type': 'application/json' });
        res.end(JSON.stringify(state ?? { error: 'unknown incident' }, null, 2));
        return;
      }
      const statusMatch = url.pathname.match(/^\/api\/status\/([A-Z]+-\d+)$/);
      if (statusMatch) {
        const status = await service.getCitizenStatus(statusMatch[1]).catch(() => null);
        res.writeHead(status ? 200 : 404, { 'content-type': 'application/json' });
        res.end(JSON.stringify(status ?? { error: 'unknown incident' }, null, 2));
        return;
      }
      if (url.pathname === '/') {
        const keys = ['GRID-101', 'GRID-102', 'GRID-103', 'GRID-104', 'ROAD-201'];
        const rows = [];
        for (const key of keys) {
          const state = await service.getDispatchState(key);
          rows.push(
            '<tr><td>' + esc(key) + '</td><td>' + esc(state.incident.summary) + '</td><td>'
            + (state.gate.allowed ? 'ready for commander approval' : 'blocked') + '</td><td>'
            + esc(state.gate.blockedReasons.join(' ') || 'none') + '</td><td>'
            + esc(state.routing ? state.routing.lane : 'no intake yet') + '</td></tr>',
          );
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(
          '<!doctype html><title>FrontBox demo mirror</title>'
          + '<h1>FrontBox for JSM and Confluence: demo mirror</h1>'
          + '<p>FrontBox checks JSM incidents against Confluence safety SOPs and spare parts via Teamwork Graph before dispatching field crews with automatic standby failover.</p>'
          + '<p>Synthetic seeded data. GRID-103 blocks on an expired SOP sign-off. GRID-104 blocks on a missing van part.</p>'
          + '<table border="1" cellspacing="0" cellpadding="6"><tr><th>Incident</th><th>Summary</th><th>Gate</th><th>Blocked reasons</th><th>Priority</th></tr>'
          + rows.join('') + '</table>'
          + '<p>JSON: /api/incidents/GRID-101 and citizen view /api/status/GRID-101</p>',
        );
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('demo mirror error');
    }
  });
  return server;
}

function esc(text) {
  return String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4321);
  const server = await createDemoServer();
  server.listen(port, () => {
    console.log('FrontBox demo mirror on http://localhost:' + port);
  });
}
