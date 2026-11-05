// Incident correlation for duplicate citizen reports of one outage.
// Deterministic pair score in [0, 1]. The evaluation harness in
// scripts/run_triage_eval.js measures precision against labeled pairs.

function tokens(text) {
  return new Set(String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4));
}

export function pairScore(a, b) {
  let score = 0;
  if (a.assetKey && b.assetKey && a.assetKey === b.assetKey) score += 0.5;
  if (a.geoCell && b.geoCell && a.geoCell === b.geoCell) score += 0.25;
  if (a.hazardClass && b.hazardClass && a.hazardClass === b.hazardClass) score += 0.1;
  const at = tokens(a.summary);
  const bt = tokens(b.summary);
  const shared = [...at].filter((t) => bt.has(t)).length;
  const union = new Set([...at, ...bt]).size || 1;
  score += 0.15 * (shared / union);
  return Math.min(1, Math.round(score * 1000) / 1000);
}

export const CORRELATION_THRESHOLD = 0.6;

export function correlate(reports, threshold = CORRELATION_THRESHOLD) {
  const clusters = [];
  for (const report of reports) {
    const hit = clusters.find((cluster) => pairScore(cluster[0], report) >= threshold);
    if (hit) hit.push(report);
    else clusters.push([report]);
  }
  return clusters;
}

export function inferHazardClass(summary, description = '') {
  const text = (String(summary ?? '') + ' ' + String(description ?? '')).toLowerCase();
  if (text.includes('transformer') || text.includes('substation') || text.includes('feeder') || text.includes('voltage') || text.includes('150kv') || text.includes('switchgear')) return 'high-voltage';
  if (text.includes('collision') || text.includes('stranded')) return 'collision';
  if (text.includes('outage') || text.includes('power')) return 'outage';
  if (text.includes('flood')) return 'flooding';
  if (text.includes('fire')) return 'fire';
  return 'unknown';
}
