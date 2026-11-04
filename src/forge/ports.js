import { fetchLinkedObjects, pickSopPage } from './team-graph.js';
import { loadSeed } from './seed.js';

// Forge adapters for the Reader and Writer ports. Hosted storage only
// (Runs on Atlassian). The Forge `route` tag is injected from src/index.js
// so this module stays importable in plain Node tests with a fake API.
// Live product data wins when site config exists; the seeded demo graph
// is the fallback for empty judge sites (TRAPS T1). Every live failure
// degrades to the seed or to null. The gate then blocks with a reason.

export const CONFIG_KEY = 'frontbox:config';
// Site config shape, written by an admin into Forge storage:
// {
//   assetsWorkspaceId: string,
//   assetsAqlTemplate: string with {issueKey} placeholder,
//   sopPageByAsset: { [assetKey]: confluencePageId },
//   evidenceSpaceId: string
// }

const intakeKey = (issueKey) => 'frontbox:intake:' + issueKey;
const leaseKey = (issueKey) => 'frontbox:lease:' + issueKey;
const LEASE_INDEX_KEY = 'frontbox:leases:index';
const DEFAULT_AQL = '"Linked Issues" = "{issueKey}"';

export function mapAssetsObject(object) {
  if (!object || typeof object !== 'object') return null;
  const assetKey = object.objectKey ?? object.key ?? object.id;
  if (!assetKey) return null;
  let requiredParts = [];
  for (const attribute of object.attributes ?? []) {
    const name = attribute?.objectTypeAttribute?.name ?? attribute?.name ?? '';
    if (String(name).toLowerCase().includes('required parts')) {
      requiredParts = (attribute.objectAttributeValues ?? [])
        .flatMap((v) => String(v.value ?? v.displayValue ?? '').split(','))
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return {
    assetKey: String(assetKey),
    name: object.label ?? object.name ?? String(assetKey),
    requiredParts,
    source: 'jira-assets',
  };
}

export function bundleToStorageHtml(markdown) {
  const esc = (text) => String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const out = [];
  for (const line of String(markdown ?? '').split('\n')) {
    if (line.startsWith('## ')) out.push('<h2>' + esc(line.slice(3)) + '</h2>');
    else if (line.startsWith('# ')) out.push('<h1>' + esc(line.slice(2)) + '</h1>');
    else if (line.startsWith('- ')) out.push('<p>' + esc(line) + '</p>');
    else if (line.trim() !== '') out.push('<p>' + esc(line) + '</p>');
  }
  return out.join('');
}

export function createForgePorts({ api, store, route }) {
  if (typeof route !== 'function') {
    throw new TypeError('createForgePorts requires the Forge route tag (inject from @forge/api in src/index.js)');
  }

  async function loadConfig() {
    return (await store.get(CONFIG_KEY)) ?? {};
  }
  async function seedFallback() {
    return loadSeed(store);
  }

  async function liveAsset(issueKey, config) {
    if (!config.assetsWorkspaceId) return null;
    const template = config.assetsAqlTemplate ?? DEFAULT_AQL;
    const qlQuery = template.replaceAll('{issueKey}', issueKey);
    const res = await api.asApp().requestJira(
      route`/rest/servicedeskapi/assets/workspace/${config.assetsWorkspaceId}/v1/object/aql`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qlQuery, includeAttributes: true }),
      },
    );
    if (!res.ok) return null;
    const body = await res.json();
    const first = (body?.values ?? body?.objectEntries ?? [])[0] ?? null;
    return mapAssetsObject(first);
  }

  async function liveSop(assetKey, config) {
    const pageId = config.sopPageByAsset?.[assetKey];
    if (!pageId) return null;
    const res = await api.asApp().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}/properties/frontbox-sop-signoff`,
      { method: 'GET' },
    );
    if (!res.ok) return null;
    const body = await res.json();
    const value = body?.value ?? {};
    if (!value.signedByAccountId) return { pageId, title: value.title ?? 'Linked Safety SOP' };
    return {
      pageId,
      title: value.title ?? 'Linked Safety SOP',
      signedByAccountId: value.signedByAccountId,
      signedAt: value.signedAt ?? null,
      validUntil: value.validUntil ?? null,
    };
  }

  const reader = {
    async getIncident(issueKey) {
      try {
        const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary,description,issuetype,priority`, { method: 'GET' });
        if (res.ok) {
          const body = await res.json();
          return {
            issueKey,
            summary: body?.fields?.summary ?? '',
            hazardClass: inferHazardClass(body?.fields?.summary ?? ''),
            assetKeyHint: null,
            source: 'jira',
          };
        }
      } catch { /* fall through to seed */ }
      const seed = await seedFallback();
      const hit = seed?.incidents.find((i) => i.issueKey === issueKey);
      return hit ? { ...hit, source: 'demo-seed' } : null;
    },

    async getLinkedAsset(issueKey) {
      const config = await loadConfig();
      try {
        const live = await liveAsset(issueKey, config);
        if (live) return live;
      } catch { /* fail closed to seed or null below */ }
      const seed = await seedFallback();
      if (seed?.assetsByIssue[issueKey]) return seed.assetsByIssue[issueKey];
      return null;
    },

    async getSafetySop(assetKey) {
      const config = await loadConfig();
      try {
        const live = await liveSop(assetKey, config);
        if (live) return live;
      } catch { /* fail closed to seed or null below */ }
      const seed = await seedFallback();
      if (seed?.sopsByAsset[assetKey]) return seed.sopsByAsset[assetKey];
      return null;
    },

    async getRoster() {
      const seed = await seedFallback();
      return seed?.roster ?? [];
    },

    async getIntakeRecord(issueKey) {
      return (await store.get(intakeKey(issueKey))) ?? null;
    },

    async getLease(issueKey) {
      return (await store.get(leaseKey(issueKey))) ?? null;
    },

    async listLeases() {
      const index = (await store.get(LEASE_INDEX_KEY)) ?? [];
      const leases = [];
      for (const issueKey of index) {
        const lease = await store.get(leaseKey(issueKey));
        if (lease) leases.push(lease);
      }
      return leases;
    },

    // Graph enrichment for the panel. Optional by design (partial results).
    async getGraphLinks(issueAri) {
      const linked = await fetchLinkedObjects(api, issueAri);
      return { linked, sopPage: pickSopPage(linked) };
    },
  };

  const writer = {
    async saveIntakeRecord(issueKey, record) {
      await store.set(intakeKey(issueKey), record);
    },
    async saveLease(lease) {
      await store.set(leaseKey(lease.issueKey), lease);
      const index = (await store.get(LEASE_INDEX_KEY)) ?? [];
      if (!index.includes(lease.issueKey)) {
        await store.set(LEASE_INDEX_KEY, [...index, lease.issueKey]);
      }
    },
    async postReceipt(issueKey, text) {
      try {
        await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } }),
        });
      } catch {
        await store.set('frontbox:receipt:' + issueKey + ':' + Date.now(), text);
      }
    },
    async setPriorityLane(issueKey, lane) {
      await store.set('frontbox:lane:' + issueKey, lane);
    },
    async assignCrew(issueKey, accountId) {
      await store.set('frontbox:assignment:' + issueKey, accountId);
    },
    async publishEvidencePage(issueKey, page) {
      const config = await loadConfig();
      const spaceId = page.spaceId || config.evidenceSpaceId || '';
      await store.set('frontbox:bundle:' + issueKey, { ...page, spaceId });
      if (!spaceId) {
        return { published: false, reason: 'No Confluence space id configured. Bundle stored in Forge storage only.' };
      }
      const storageHtml = page.storageHtml ?? bundleToStorageHtml(page.markdown ?? '');
      try {
        const res = await api.asApp().requestConfluence(route`/wiki/api/v2/pages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            spaceId,
            status: 'current',
            title: page.title,
            body: { representation: 'storage', value: storageHtml },
          }),
        });
        if (!res.ok) {
          return { published: false, reason: 'Confluence refused the page create (HTTP ' + res.status + '). Bundle kept in Forge storage.' };
        }
        const body = await res.json();
        return { published: true, pageId: body?.id ?? null };
      } catch {
        return { published: false, reason: 'Confluence page create failed. Bundle kept in Forge storage.' };
      }
    },
  };

  return { reader, writer };
}

function inferHazardClass(summary) {
  const text = summary.toLowerCase();
  if (text.includes('transformer') || text.includes('substation') || text.includes('feeder') || text.includes('voltage')) return 'high-voltage';
  if (text.includes('collision') || text.includes('stranded')) return 'collision';
  if (text.includes('outage') || text.includes('power')) return 'outage';
  if (text.includes('flood')) return 'flooding';
  if (text.includes('fire')) return 'fire';
  return 'unknown';
}
