import { fetchLinkedObjects, pickSopPage } from './team-graph.js';
import { loadSeed } from './seed.js';
import { inferHazardClass } from '../frontbox/domain/triage.js';

// Forge adapters for the Reader and Writer ports. Hosted storage only
// (Runs on Atlassian). The Forge `route` tag is injected from src/index.js
// so this module stays importable in plain Node tests with a fake API.
// Live product data wins when site config exists; the seeded demo graph
// is the fallback for empty judge sites (TRAPS T1). Every live failure
// degrades to the seed or to null. The gate then blocks with a reason.

export const CONFIG_KEY = 'frontbox:config';
// Site or project-scoped config shape, written by an admin into Forge storage:
// {
//   assetsWorkspaceId: string,
//   assetsAqlTemplate: string with {issueKey} placeholder,
//   sopPageByAsset: { [assetKey]: confluencePageId },
//   evidenceSpaceId: string
// }

export function scopeOf(keyOrScope) {
  const raw = String(keyOrScope ?? '').trim().toUpperCase();
  if (!raw) return 'DEFAULT';
  const dash = raw.indexOf('-');
  return dash > 0 ? raw.slice(0, dash) : raw;
}

const configKey = (scope) => (!scope || scope === 'DEFAULT' ? CONFIG_KEY : CONFIG_KEY + ':' + scopeOf(scope));
const intakeKey = (issueKey) => 'frontbox:intake:' + issueKey;
const LATEST_DRAFT_KEY = 'frontbox:intake:latest-draft';
const leaseKey = (issueKey) => 'frontbox:lease:' + issueKey;
const LEASE_INDEX_KEY = 'frontbox:leases:index';
const scopedLeaseIndexKey = (scope) => LEASE_INDEX_KEY + ':' + scopeOf(scope);
const DEFAULT_AQL = '"Linked Issues" = "{issueKey}"';
const DEMO_KEYS = new Set([
  'GRID-101', 'GRID-102', 'GRID-103', 'GRID-104', 'ROAD-201',
  'AST-TRF-4001', 'AST-FDR-2200', 'AST-SUB-0900', 'AST-SWG-5100', 'AST-VAN-3300',
]);

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

  async function loadConfig(keyOrScope) {
    const scope = scopeOf(keyOrScope);
    const [base, scoped] = await Promise.all([
      store.get(CONFIG_KEY),
      scope !== 'DEFAULT' ? store.get(configKey(scope)) : Promise.resolve(null),
    ]);
    return { ...(base ?? {}), ...(scoped ?? {}) };
  }
  async function seedFallback(key) {
    if (key && !DEMO_KEYS.has(key)) return null;
    return loadSeed(store);
  }

  async function liveAsset(issueKey, config) {
    if (config.assetsWorkspaceId) {
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
      if (res.ok) {
        const body = await res.json();
        const first = (body?.values ?? body?.objectEntries ?? [])[0] ?? null;
        const mapped = mapAssetsObject(first);
        if (mapped) return mapped;
      }
    }
    const propRes = await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}/properties/frontbox-asset`,
      { method: 'GET' },
    );
    if (!propRes?.ok) return null;
    const propBody = await propRes.json();
    const val = propBody?.value;
    if (!val || typeof val !== 'object' || !val.assetKey) return null;
    if (val.sop && typeof val.sop === 'object' && val.sop.pageId) {
      await store.set('frontbox:sop:' + val.assetKey, { ...val.sop, source: 'jira-issue-property' });
    }
    if (Array.isArray(val.roster) && val.roster.length > 0) {
      await store.set('frontbox:roster:' + scopeOf(issueKey), val.roster);
    }
    return {
      assetKey: String(val.assetKey),
      name: val.name ?? String(val.assetKey),
      requiredParts: Array.isArray(val.requiredParts) ? val.requiredParts : [],
      source: 'jira-issue-property',
    };
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
          const summary = body?.fields?.summary ?? '';
          const description = typeof body?.fields?.description === 'string' ? body.fields.description : '';
          return {
            issueKey,
            summary,
            hazardClass: inferHazardClass(summary, description),
            assetKeyHint: null,
            source: 'jira',
          };
        }
      } catch { /* fall through to seed */ }
      const seed = await seedFallback(issueKey);
      const hit = seed?.incidents.find((i) => i.issueKey === issueKey);
      return hit ? { ...hit, source: 'demo-seed', degradedReason: 'live-lookup-skipped-or-unavailable' } : null;
    },

    async getConfig(keyOrScope) {
      return loadConfig(keyOrScope);
    },

    async getLinkedAsset(issueKey) {
      const config = await loadConfig(issueKey);
      try {
        const live = await liveAsset(issueKey, config);
        if (live) return live;
      } catch { /* fail closed to seed or null below */ }
      const seed = await seedFallback(issueKey);
      if (seed?.assetsByIssue[issueKey]) {
        return { ...seed.assetsByIssue[issueKey], source: 'demo-seed', degradedReason: 'live-lookup-skipped-or-unavailable' };
      }
      return null;
    },

    async getSafetySop(assetKey) {
      const config = await loadConfig(assetKey);
      try {
        const live = await liveSop(assetKey, config);
        if (live) return { ...live, source: 'confluence-sop' };
      } catch { /* fail closed to stored or seed below */ }
      const storedSop = await store.get('frontbox:sop:' + assetKey);
      if (storedSop && storedSop.pageId) {
        return { ...storedSop, source: storedSop.source ?? 'jira-issue-property' };
      }
      const seed = await seedFallback(assetKey);
      if (seed?.sopsByAsset[assetKey]) {
        return { ...seed.sopsByAsset[assetKey], source: 'demo-seed', degradedReason: 'live-lookup-skipped-or-unavailable' };
      }
      return null;
    },

    async getRoster(scope) {
      if (scope) {
        const projKey = scopeOf(scope);
        const scopedRoster = await store.get('frontbox:roster:' + projKey);
        if (Array.isArray(scopedRoster) && scopedRoster.length > 0) return scopedRoster;
        try {
          const res = await api.asApp().requestJira(
            route`/rest/api/3/project/${projKey}/properties/frontbox-roster`,
            { method: 'GET' },
          );
          if (res?.ok) {
            const body = await res.json();
            const list = Array.isArray(body?.value?.roster)
              ? body.value.roster
              : (Array.isArray(body?.value) ? body.value : null);
            if (list && list.length > 0) {
              await store.set('frontbox:roster:' + projKey, list);
              return list;
            }
          }
        } catch { /* fall through to seed */ }
      }
      const seed = await seedFallback();
      return seed?.roster ?? [];
    },

    async getIntakeRecord(issueKey) {
      return (await store.get(intakeKey(issueKey))) ?? null;
    },

    async getLease(issueKey) {
      return (await store.get(leaseKey(issueKey))) ?? null;
    },

    async listLeases(scope) {
      const idxKey = scope ? scopedLeaseIndexKey(scope) : LEASE_INDEX_KEY;
      const index = (await store.get(idxKey)) ?? [];
      const fetched = await Promise.all(index.map((issueKey) => store.get(leaseKey(issueKey))));
      return fetched.filter(Boolean);
    },

    // Graph enrichment for the panel. Optional by design (partial results).
    async getGraphLinks(issueAri) {
      const linked = await fetchLinkedObjects(api, issueAri);
      return { linked, sopPage: pickSopPage(linked) };
    },
  };

  const writer = {
    async saveConfig(config, scope) {
      const targetKey = configKey(scope);
      const existing = (await store.get(targetKey)) ?? {};
      const next = { ...existing, ...(config ?? {}) };
      await store.set(targetKey, next);
      return next;
    },
    async saveIntakeRecord(issueKey, record) {
      await store.set(intakeKey(issueKey), record);
      if (String(issueKey).startsWith('DRAFT-')) {
        await store.set(LATEST_DRAFT_KEY, { draftKey: issueKey, record });
      }
    },
    async bindDraftIntake(issueKey, explicitDraftKey) {
      const existing = await store.get(intakeKey(issueKey));
      if (existing) return existing;
      let draftKey = explicitDraftKey;
      let draftRecord = draftKey ? await store.get(intakeKey(draftKey)) : null;
      if (!draftRecord) {
        const latest = await store.get(LATEST_DRAFT_KEY);
        if (latest && latest.record) {
          draftKey = latest.draftKey;
          draftRecord = latest.record;
        }
      }
      if (!draftRecord) return null;
      const bound = { ...draftRecord, issueKey, boundFromDraftKey: draftKey };
      await store.set(intakeKey(issueKey), bound);
      await store.set(LATEST_DRAFT_KEY, null);
      return bound;
    },
    async saveLease(lease) {
      const existing = await store.get(leaseKey(lease.issueKey));
      if (
        existing
        && existing.leaseId === lease.leaseId
        && typeof existing.version === 'number'
        && typeof lease.version === 'number'
        && lease.version <= existing.version
      ) {
        throw new Error(
          'Optimistic lock conflict on lease ' + lease.leaseId + ' for ' + lease.issueKey
          + ': stored version ' + existing.version + ' >= incoming version ' + lease.version,
        );
      }
      const sKey = scopedLeaseIndexKey(lease.issueKey);
      const [globalIndex, scopedIndex] = await Promise.all([
        store.get(LEASE_INDEX_KEY),
        store.get(sKey),
      ]);
      const nextGlobal = Array.from(new Set([...(globalIndex ?? []), lease.issueKey]));
      const nextScoped = Array.from(new Set([...(scopedIndex ?? []), lease.issueKey]));
      await Promise.all([
        store.set(leaseKey(lease.issueKey), lease),
        store.set(LEASE_INDEX_KEY, nextGlobal),
        store.set(sKey, nextScoped),
      ]);
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
      if (!String(issueKey).startsWith('DRAFT-')) {
        try {
          await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/frontbox-lane`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ lane }),
          });
        } catch { /* best-effort mirror to Jira issue entity property */ }
      }
    },
    async assignCrew(issueKey, accountId) {
      await store.set('frontbox:assignment:' + issueKey, accountId);
      if (!String(issueKey).startsWith('DRAFT-')) {
        try {
          await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/frontbox-assignment`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accountId }),
          });
        } catch { /* best-effort mirror to Jira issue entity property */ }
      }
    },
    async publishEvidencePage(issueKey, page) {
      const config = await loadConfig(issueKey);
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
