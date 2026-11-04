import { demoSeed, demoIntake } from '../frontbox/index.js';

// One-click demo seed (TRAPS T1). Writes the synthetic graph slice into
// Forge hosted storage so an empty judge site works in under 3 seconds.
// Idempotent: keys are derived from entity ids, re-seeding overwrites.

export const SEED_KEYS = {
  incidents: 'frontbox:seed:incidents',
  assetsByIssue: 'frontbox:seed:assets',
  sopsByAsset: 'frontbox:seed:sops',
  roster: 'frontbox:seed:roster',
};

export async function seedDemoWorkspace(storage) {
  const seed = demoSeed();
  await storage.set(SEED_KEYS.incidents, seed.incidents);
  await storage.set(SEED_KEYS.assetsByIssue, seed.assetsByIssue);
  await storage.set(SEED_KEYS.sopsByAsset, seed.sopsByAsset);
  await storage.set(SEED_KEYS.roster, seed.roster);
  return {
    seeded: true,
    incidents: seed.incidents.map((i) => i.issueKey),
    crews: seed.roster.map((c) => c.crewId),
    sampleIntake: demoIntake('GRID-101'),
  };
}

export async function loadSeed(storage) {
  const [incidents, assetsByIssue, sopsByAsset, roster] = await Promise.all([
    storage.get(SEED_KEYS.incidents),
    storage.get(SEED_KEYS.assetsByIssue),
    storage.get(SEED_KEYS.sopsByAsset),
    storage.get(SEED_KEYS.roster),
  ]);
  if (!incidents) return null;
  return {
    incidents,
    assetsByIssue: assetsByIssue ?? {},
    sopsByAsset: sopsByAsset ?? {},
    roster: roster ?? [],
  };
}
