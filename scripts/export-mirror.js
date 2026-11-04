import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInMemoryPorts, createDispatchService, demoSeed, demoIntake, DEMO_NOW } from '../src/frontbox/index.js';
import { esc, chip, renderBoardPage } from './board-html.js';

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
    rows.push([
      esc(key),
      esc(state.incident.summary),
      state.gate.allowed ? chip('ready for commander approval', 'ready') : chip('blocked', 'blocked'),
      esc(status.spoken.text),
      '<a href="api/' + key + '.json">dispatcher JSON</a> <a href="api/' + key + '-status.json">citizen JSON</a>',
    ]);
  }
  const html = renderBoardPage({
    note: 'Static export of the seeded demo at ' + DEMO_NOW + '. Synthetic data. GRID-103 blocks on an expired SOP sign-off. GRID-104 blocks on a missing van part. This mirror proves the dispatch core only. The Forge install is the product.',
    columns: ['Incident', 'Summary', 'Gate', 'Spoken receipt', 'Data'],
    rows,
  });
  await writeFile(path.join(outDir, 'index.html'), html + '\n', 'utf8');
  return { outDir, incidents: keys, files: 1 + keys.length * 2 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'temp/site');
  const result = await exportMirror(outDir);
  console.log('export-mirror: wrote ' + result.files + ' files to ' + result.outDir);
}
