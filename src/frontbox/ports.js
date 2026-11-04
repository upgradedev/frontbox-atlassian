// Hexagonal ports. The domain never sees Atlassian SDKs (STANDARDS A5).
// Least privilege (A7) is structural: read paths receive only a Reader,
// mutation paths require a Writer, and the Writer re-verifies the exact
// content-addressed plan a human approved before it writes anything.
//
// Reader contract (all async, all read-only):
//   getIncident(issueKey) -> { issueKey, summary, hazardClass, assetKeyHint }
//   getLinkedAsset(issueKey) -> { assetKey, name, requiredParts } | null
//   getSafetySop(assetKey) -> { pageId, title, signedByAccountId, signedAt, validUntil } | null
//   getRoster() -> [{ crewId, displayName, accountId, onShift, distanceKm, certifications, vanParts }]
//   getIntakeRecord(issueKey) -> stored intake record | null
//   getLease(issueKey) -> lease | null
//   listLeases() -> [lease]
//
// Writer contract (all async, the only mutation surface):
//   saveIntakeRecord(issueKey, record)
//   saveLease(lease)
//   postReceipt(issueKey, text)
//   setPriorityLane(issueKey, lane)
//   assignCrew(issueKey, accountId)
//   publishEvidencePage(issueKey, { spaceId, title, markdown, bundleId })
//     -> { published, pageId?, reason? }

export class LeastPrivilegeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LeastPrivilegeError';
  }
}

const READER_METHODS = ['getIncident', 'getLinkedAsset', 'getSafetySop', 'getRoster', 'getIntakeRecord', 'getLease', 'listLeases'];
const WRITER_METHODS = ['saveIntakeRecord', 'saveLease', 'postReceipt', 'setPriorityLane', 'assignCrew', 'publishEvidencePage'];

export function assertReader(reader) {
  for (const method of READER_METHODS) {
    if (!reader || typeof reader[method] !== 'function') {
      throw new LeastPrivilegeError('Reader port is missing method "' + method + '"');
    }
  }
  return reader;
}

export function assertWriter(writer) {
  for (const method of WRITER_METHODS) {
    if (!writer || typeof writer[method] !== 'function') {
      throw new LeastPrivilegeError('Writer port is missing method "' + method + '". Read identity cannot write.');
    }
  }
  return writer;
}

// In-memory ports for tests, CI, and the anonymous demo mirror.
export function createInMemoryPorts(seed = {}) {
  const store = {
    incidents: new Map((seed.incidents ?? []).map((i) => [i.issueKey, i])),
    assetsByIssue: new Map(Object.entries(seed.assetsByIssue ?? {})),
    sopsByAsset: new Map(Object.entries(seed.sopsByAsset ?? {})),
    roster: [...(seed.roster ?? [])],
    intakes: new Map(),
    leases: new Map(),
    receipts: [],
    priorities: new Map(),
    assignments: new Map(),
    publishedPages: [],
  };
  const reader = {
    async getIncident(issueKey) { return store.incidents.get(issueKey) ?? null; },
    async getLinkedAsset(issueKey) { return store.assetsByIssue.get(issueKey) ?? null; },
    async getSafetySop(assetKey) { return store.sopsByAsset.get(assetKey) ?? null; },
    async getRoster() { return [...store.roster]; },
    async getIntakeRecord(issueKey) { return store.intakes.get(issueKey) ?? null; },
    async getLease(issueKey) { return store.leases.get(issueKey) ?? null; },
    async listLeases() { return [...store.leases.values()]; },
  };
  const writer = {
    async saveIntakeRecord(issueKey, record) { store.intakes.set(issueKey, record); },
    async saveLease(lease) { store.leases.set(lease.issueKey, lease); },
    async postReceipt(issueKey, text) { store.receipts.push({ issueKey, text }); },
    async setPriorityLane(issueKey, lane) { store.priorities.set(issueKey, lane); },
    async assignCrew(issueKey, accountId) { store.assignments.set(issueKey, accountId); },
    async publishEvidencePage(issueKey, page) {
      store.publishedPages.push({ issueKey, ...page });
      if (!page.spaceId) {
        return { published: false, reason: 'No Confluence space id configured. Bundle stored locally only.' };
      }
      return { published: true, pageId: 'mem-page-' + store.publishedPages.length };
    },
  };
  return { reader, writer, store };
}
