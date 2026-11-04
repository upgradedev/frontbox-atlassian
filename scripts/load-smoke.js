import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInMemoryPorts, createDispatchService, demoSeed, demoIntake, DEMO_NOW } from '../src/frontbox/index.js';

// Scale smoke for the deterministic core (STANDARDS performance row).
// Replays the seeded incidents through intake + gate verification N
// times and reports throughput. Fails if the batch budget breaks.
// Usage: node scripts/load-smoke.js [rounds]   (default 100 => 500 checks)

export async function runLoadSmoke(rounds = 100) {
  const ports = createInMemoryPorts(demoSeed());
  const service = createDispatchService({ reader: ports.reader, writer: ports.writer, clock: () => DEMO_NOW });
  const keys = ['GRID-101', 'GRID-102', 'GRID-103', 'GRID-104', 'ROAD-201'];
  const started = performance.now();
  let checks = 0;
  let allowed = 0;
  for (let round = 0; round < rounds; round += 1) {
    for (const key of keys) {
      await service.submitIntake(key, demoIntake(key));
      const result = await service.verifySafety(key);
      checks += 1;
      if (result.allowed) allowed += 1;
    }
  }
  const elapsedMs = Math.round(performance.now() - started);
  return {
    rounds,
    checks,
    allowed,
    blocked: checks - allowed,
    elapsedMs,
    perCheckMs: Math.round((elapsedMs / checks) * 100) / 100,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rounds = Number(process.argv[2] ?? 100);
  const result = await runLoadSmoke(rounds);
  console.log('load-smoke rounds=' + result.rounds + ' checks=' + result.checks
    + ' allowed=' + result.allowed + ' blocked=' + result.blocked
    + ' elapsedMs=' + result.elapsedMs + ' perCheckMs=' + result.perCheckMs);
  if (result.elapsedMs >= 10_000 || result.perCheckMs >= 20) {
    console.error('load-smoke: FAIL (budgets: batch < 10000 ms, per check < 20 ms)');
    process.exitCode = 1;
  } else {
    console.log('load-smoke: PASS');
  }
}
