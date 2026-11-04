import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInMemoryPorts, createDispatchService, demoSeed, demoIntake, DEMO_NOW } from '../src/frontbox/index.js';

// Static export of the demo mirror for any static host (D-1 prep).
// Writes temp/site/ by default: index.html plus one JSON file per
// incident and citizen status. No server code ships in the export.

export async function exportMirror(outDir) {
  const ports = createInMemoryPorts(demoSeed());
  const service = createDispatchService({ reader: ports.reader, writer: ports.writer, clock: () => DEMO_NOW });
  const keys = ['GRID-101', 'GRID-102', 'GRID-103', 'GRID-104', 'ROAD-201'];
  await service.submitIntake('GRID-101', demoIntake('GRID-101'));
  await service.submitIntake('ROAD-201', demoIntake('ROAD-201'));
  await mkdir(path.join(outDir, 'api'), { recursive: true });
  const rows = [];
  for (const key of keys) {
    const state = await service.getDispatchState(key);
    const status = await service.getCitizenStatus(key);
    await writeFile(path.join(outDir, 'api', key + '.json'), JSON.stringify(state, null, 2) + '\n', 'utf8');
    await writeFile(path.join(outDir, 'api', key + '-status.json'), JSON.stringify(status, null, 2) + '\n', 'utf8');
    rows.push(
      '<tr><td>' + key + '</td><td>' + esc(state.incident.summary) + '</td><td>'
      + (state.gate.allowed ? 'ready for commander approval' : 'blocked') + '</td><td>'
      + esc(status.spoken.text) + '</td><td><a href="api/' + key + '.json">dispatcher JSON</a> '
      + '<a href="api/' + key + '-status.json">citizen JSON</a></td></tr>',
    );
  }
  const html = '<!doctype html><title>FrontBox demo mirror (static export)</title>'
    + '<h1>FrontBox for JSM and Confluence: demo mirror</h1>'
    + '<p>FrontBox checks JSM incidents against Confluence safety SOPs and spare parts via Teamwork Graph before dispatching field crews with automatic standby failover.</p>'
    + '<p>Static export of the seeded demo at ' + DEMO_NOW + '. Synthetic data. GRID-103 blocks on an expired SOP sign-off. GRID-104 blocks on a missing van part.</p>'
    + '<table border="1" cellspacing="0" cellpadding="6"><tr><th>Incident</th><th>Summary</th><th>Gate</th><th>Spoken receipt</th><th>Data</th></tr>'
    + rows.join('') + '</table>';
  await writeFile(path.join(outDir, 'index.html'), html + '\n', 'utf8');
  return { outDir, incidents: keys, files: 1 + keys.length * 2 };
}

function esc(text) {
  return String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'temp/site');
  const result = await exportMirror(outDir);
  console.log('export-mirror: wrote ' + result.files + ' files to ' + result.outDir);
}
