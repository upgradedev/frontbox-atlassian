import { pairScore, CORRELATION_THRESHOLD } from '../src/frontbox/domain/triage.js';
import { evaluateDispatchGate } from '../src/frontbox/domain/dispatch-gate.js';

// J3 harness. Synthetic labeled fixture, stated as such: 60 report pairs
// (30 same-outage, 30 different) plus 20 unsafe dispatch fixtures.
// Prints the measured precision and blocked rate. Fails under target.

function buildPairs() {
  const pairs = [];
  for (let i = 0; i < 30; i += 1) {
    const asset = 'AST-EVAL-' + i;
    const sameAsset = i < 28; // 2 positives arrive without an asset hint
    pairs.push({
      label: 1,
      a: { assetKey: asset, geoCell: 'cell-' + i, hazardClass: 'outage', summary: 'power out after transformer bang street ' + i },
      b: { assetKey: sameAsset ? asset : null, geoCell: 'cell-' + i, hazardClass: 'outage', summary: 'no power since loud bang near transformer street ' + i },
    });
  }
  for (let i = 0; i < 30; i += 1) {
    const hardNegative = i < 2; // same_asset recurring fault, new incident
    pairs.push({
      label: 0,
      a: { assetKey: 'AST-EVAL-N' + i, geoCell: 'cell-n' + i, hazardClass: 'outage', summary: 'flickering lights reported block ' + i },
      b: hardNegative
        ? { assetKey: 'AST-EVAL-N' + i, geoCell: 'cell-n' + i, hazardClass: 'outage', summary: 'power out again same street block ' + i }
        : { assetKey: 'AST-EVAL-M' + i, geoCell: 'cell-m' + i, hazardClass: 'breakdown', summary: 'vehicle stalled near market road ' + i },
    });
  }
  return pairs;
}

function buildUnsafeDispatches(now) {
  const base = {
    incident: { issueKey: 'GRID-EVAL', hazardClass: 'high-voltage' },
    asset: { assetKey: 'AST-EVAL-1', name: 'Eval transformer', requiredParts: ['part-a', 'part-b'] },
    sop: { pageId: 'sop-1', title: 'Eval SOP', signedByAccountId: 'lead-1', signedAt: '2026-11-01T00:00:00.000Z', validUntil: '2027-03-01T00:00:00.000Z' },
    crew: { crewId: 'crew-eval', certifications: ['high-voltage'], vanParts: ['part-a', 'part-b'] },
    policy: { autoDispatch: false, commanderApproved: true },
    now,
  };
  const variants = [];
  for (let i = 0; i < 20; i += 1) {
    const kind = i % 4;
    if (kind === 0) variants.push({ ...base, crew: { ...base.crew, vanParts: ['part-a'] } });
    if (kind === 1) variants.push({ ...base, sop: { ...base.sop, validUntil: '2026-01-01T00:00:00.000Z' } });
    if (kind === 2) variants.push({ ...base, crew: { ...base.crew, certifications: ['outage'] } });
    if (kind === 3) variants.push({ ...base, asset: null });
  }
  return variants;
}

const now = '2026-12-01T09:00:00.000Z';
const pairs = buildPairs();
let tp = 0;
let fp = 0;
let fn = 0;
let tn = 0;
for (const pair of pairs) {
  const predicted = pairScore(pair.a, pair.b) >= CORRELATION_THRESHOLD ? 1 : 0;
  if (predicted === 1 && pair.label === 1) tp += 1;
  else if (predicted === 1) fp += 1;
  else if (pair.label === 1) fn += 1;
  else tn += 1;
}
const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
const recall = tp + fn === 0 ? 0 : tp / (tp + fn);

const started = performance.now();
const dispatches = buildUnsafeDispatches(now);
const blocked = dispatches.filter((d) => !evaluateDispatchGate(d).allowed).length;
const elapsedMs = Math.round(performance.now() - started);
const blockedRate = blocked / dispatches.length;

console.log('FrontBox triage evaluation (synthetic fixture)');
console.log('pairs=' + pairs.length + ' threshold=' + CORRELATION_THRESHOLD);
console.log('tp=' + tp + ' fp=' + fp + ' fn=' + fn + ' tn=' + tn);
console.log('precision=' + precision.toFixed(3) + ' recall=' + recall.toFixed(3));
console.log('unsafe-dispatches=' + dispatches.length + ' blocked=' + blocked + ' blockedRate=' + blockedRate.toFixed(3) + ' gateBatchMs=' + elapsedMs);

if (precision < 0.9 || blockedRate < 1 || elapsedMs >= 2000) {
  console.error('run_triage_eval: FAIL (targets: precision >= 0.900, blockedRate = 1.000, batch < 2000 ms)');
  process.exitCode = 1;
} else {
  console.log('run_triage_eval: PASS');
}
