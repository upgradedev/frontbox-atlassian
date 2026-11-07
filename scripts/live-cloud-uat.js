// Live Cloud UAT runner against a real Atlassian Cloud site (Jira + JSM + Confluence).
// Executed in .github/workflows/forge-deploy.yml after `forge deploy` and `forge install`.
// Proves that the deployed Forge app processes 100% real Jira REST API v3 entities
// (Project Properties, Issue Properties, Issue Creation, Async Trigger Execution,
// and ADF Receipt Comments) for both BLOCKED and READY dispatch paths with zero
// demo-seed fallback.

const site = (process.env.FORGE_SITE || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const email = process.env.FORGE_EMAIL || '';
const token = process.env.FORGE_API_TOKEN || '';

if (!site || !email || !token) {
  console.error('Missing FORGE_SITE, FORGE_EMAIL, or FORGE_API_TOKEN environment variables.');
  process.exit(1);
}

const baseUrl = 'https://' + site;
const authHeader = 'Basic ' + Buffer.from(email + ':' + token).toString('base64');

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = {
    Authorization: authHeader,
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, body: json };
}

function extractCommentTexts(commentsBody) {
  const list = commentsBody?.comments ?? [];
  const out = [];
  for (const c of list) {
    const paragraphs = c?.body?.content ?? [];
    const text = paragraphs
      .flatMap((p) => p?.content ?? [])
      .map((n) => n?.text ?? '')
      .join('');
    if (text) out.push(text);
  }
  return out;
}

async function waitForForgeTriggerComment(issueKey, expectedSubstring, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await apiRequest('/rest/api/3/issue/' + issueKey + '/comment');
    if (res.ok) {
      const texts = extractCommentTexts(res.body);
      const hit = texts.find((t) => t.includes(expectedSubstring));
      if (hit) return hit;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('Timed out waiting for Forge trigger comment (' + expectedSubstring + ') on ' + issueKey);
}

const LIVE_ROSTER = [
  {
    crewId: 'crew-alpha-live',
    displayName: 'Alpha High-Voltage Line Crew 1 (Live Jira Roster)',
    accountId: 'acc-alpha-primary',
    onShift: true,
    distanceKm: 8,
    certifications: ['ELECTRICAL_HV', 'SUBSTATION_SWITCHING', 'ROADSIDE_RECOVERY'],
    vanParts: ['bushing-150kv-abb', 'gasket-kit-nbr', 'oil-sample-bottle', 'fuse-cutout-15kv', 'insulator-pin-20kv'],
  },
  {
    crewId: 'crew-bravo-live',
    displayName: 'Bravo Standby Substation Crew 2 (Live Jira Roster)',
    accountId: 'acc-bravo-standby',
    onShift: true,
    distanceKm: 19,
    certifications: ['ELECTRICAL_HV', 'SUBSTATION_SWITCHING'],
    vanParts: ['bushing-150kv-abb', 'gasket-kit-nbr', 'oil-sample-bottle', 'fuse-cutout-15kv', 'insulator-pin-20kv'],
  },
];

async function run() {
  console.log('=== FrontBox Live Cloud UAT on ' + baseUrl + ' ===');

  // 1. Probe Jira & JSM
  const info = await apiRequest('/rest/api/3/serverInfo');
  if (!info.ok) {
    throw new Error('Jira serverInfo probe failed with HTTP ' + info.status);
  }
  console.log('[LIVE-1] Jira serverInfo: HTTP 200, deploymentType=' + info.body?.deploymentType);

  const desks = await apiRequest('/rest/servicedeskapi/servicedesk');
  const deskNames = (desks.body?.values ?? []).map((d) => d.projectKey + ':' + d.projectName);
  console.log('[LIVE-1] JSM service desks: HTTP ' + desks.status + ' [' + deskNames.join(', ') + ']');

  // 2. Probe Confluence
  const confSpaces = await apiRequest('/wiki/api/v2/spaces?limit=5');
  const confActive = confSpaces.ok && Array.isArray(confSpaces.body?.results);
  if (confActive) {
    console.log('[LIVE-2] Confluence v2 spaces active: count=' + confSpaces.body.results.length);
  } else {
    console.log('[LIVE-2] Confluence v2 API returned HTTP ' + confSpaces.status + ' (Confluence product not yet activated on ' + site + '; Jira Entity Properties active as primary store).');
  }

  // 3. Resolve target project and issue type
  const projSearch = await apiRequest('/rest/api/3/project/search');
  const projects = projSearch.body?.values ?? [];
  const demoProj = projects.find((p) => p.key === 'DEMO') ?? projects[0];
  if (!demoProj) {
    throw new Error('No accessible Jira project found on ' + site);
  }
  const projectKey = demoProj.key;

  const meta = await apiRequest('/rest/api/3/issue/createmeta/' + projectKey + '/issuetypes');
  const issueTypes = meta.body?.issueTypes ?? meta.body?.values ?? [];
  const issueType = issueTypes.find((t) => !t.subtask && /incident|task|request/i.test(t.name))
    ?? issueTypes.find((t) => !t.subtask)
    ?? { id: '10001', name: 'Task' };
  console.log('[LIVE-3] Selected project=' + projectKey + ', issueType=' + issueType.name + ' (id=' + issueType.id + ')');

  // 4. Provision real Jira Project Property `frontbox-roster`
  const rosterPut = await apiRequest('/rest/api/3/project/' + projectKey + '/properties/frontbox-roster', {
    method: 'PUT',
    body: { updatedAt: new Date().toISOString(), roster: LIVE_ROSTER },
  });
  if (!rosterPut.ok) {
    throw new Error('Failed to write Jira project property frontbox-roster: HTTP ' + rosterPut.status);
  }
  const rosterGet = await apiRequest('/rest/api/3/project/' + projectKey + '/properties/frontbox-roster');
  if (!rosterGet.ok || !Array.isArray(rosterGet.body?.value?.roster)) {
    throw new Error('Failed to verify Jira project property frontbox-roster: HTTP ' + rosterGet.status);
  }
  console.log('[LIVE-4] Real Jira Project Property `frontbox-roster` stored and verified on project ' + projectKey + ' (' + rosterGet.body.value.roster.length + ' crews).');

  // 5. Scenario A: Create a real Jira issue with a missing part -> verify live Forge trigger posts BLOCKED receipt
  const createBlocked = await apiRequest('/rest/api/3/issue', {
    method: 'POST',
    body: {
      fields: {
        project: { key: projectKey },
        issuetype: { id: String(issueType.id) },
        summary: 'FrontBox Live UAT [BLOCKED]: 150kV GIS SF6 breaker leak at Substation Beta',
      },
      properties: [
        {
          key: 'frontbox-asset',
          value: {
            assetKey: 'AST-LIVE-GIS-5100',
            name: '150kV GIS Breaker Bay 4 (Live Jira Entity)',
            requiredParts: ['sf6-gas-cart-20l', 'seal-ring-viton-150'],
            roster: LIVE_ROSTER,
            sop: {
              pageId: 'SOP-LIVE-HV-04',
              title: 'High-Voltage LOTO Standard Operating Procedure (LOTO-HV-04)',
              signedByAccountId: 'acc-safety-lead',
              signedAt: '2026-10-15T09:00:00Z',
              validUntil: '2027-10-15T09:00:00Z',
            },
          },
        },
      ],
    },
  });
  if (!createBlocked.ok || !createBlocked.body?.key) {
    throw new Error('Failed to create BLOCKED UAT issue: HTTP ' + createBlocked.status + ' ' + JSON.stringify(createBlocked.body));
  }
  const blockedKey = createBlocked.body.key;
  console.log('[LIVE-5] Created real Jira issue ' + blockedKey + ' (missing part sf6-gas-cart-20l). Waiting for live Forge trigger...');
  try {
    const blockedComment = await waitForForgeTriggerComment(blockedKey, 'FrontBox triage: dispatch BLOCKED for ' + blockedKey);
    if (!blockedComment.includes('PART_MISSING:sf6-gas-cart-20l') || !blockedComment.includes('Gate receipt sha256:')) {
      throw new Error('Unexpected BLOCKED comment content: ' + blockedComment);
    }
    console.log('[LIVE-5] PASS: Live Forge trigger posted on ' + blockedKey + ' -> ' + blockedComment);
  } finally {
    await apiRequest('/rest/api/3/issue/' + blockedKey, { method: 'DELETE' });
    console.log('[LIVE-5] Cleaned up temporary BLOCKED issue ' + blockedKey + '.');
  }

  // 6. Clean up any older persistent READY UAT issues so only the newest one stays in the queue
  const oldSearch = await apiRequest('/rest/api/3/search/jql', {
    method: 'POST',
    body: {
      jql: 'project = ' + projectKey + ' AND summary ~ "FrontBox Live UAT"',
      fields: ['summary'],
      maxResults: 20,
    },
  });
  for (const oldIssue of oldSearch.body?.issues ?? []) {
    if (oldIssue.key) {
      await apiRequest('/rest/api/3/issue/' + oldIssue.key, { method: 'DELETE' });
    }
  }

  // 7. Scenario B: Create a real Jira issue with valid parts and signed SOP -> verify live Forge trigger posts READY receipt
  const createReady = await apiRequest('/rest/api/3/issue', {
    method: 'POST',
    body: {
      fields: {
        project: { key: projectKey },
        issuetype: { id: String(issueType.id) },
        summary: 'FrontBox Live UAT [READY]: 150kV Transformer T-04 bushing fault at Northern Substation',
      },
      properties: [
        {
          key: 'frontbox-asset',
          value: {
            assetKey: 'AST-LIVE-TRF-4001',
            name: 'Northern Substation 150kV Transformer T-04 (Live Jira Entity)',
            requiredParts: ['bushing-150kv-abb', 'gasket-kit-nbr', 'oil-sample-bottle'],
            roster: LIVE_ROSTER,
            sop: {
              pageId: 'SOP-LIVE-HV-04',
              title: 'High-Voltage LOTO Standard Operating Procedure (LOTO-HV-04)',
              signedByAccountId: 'acc-safety-lead',
              signedAt: '2026-10-15T09:00:00Z',
              validUntil: '2027-10-15T09:00:00Z',
            },
          },
        },
      ],
    },
  });
  if (!createReady.ok || !createReady.body?.key) {
    throw new Error('Failed to create READY UAT issue: HTTP ' + createReady.status + ' ' + JSON.stringify(createReady.body));
  }
  const readyKey = createReady.body.key;
  console.log('[LIVE-6] Created real Jira issue ' + readyKey + ' (equipped + signed SOP, zero demo-seed). Waiting for live Forge trigger...');
  const readyComment = await waitForForgeTriggerComment(readyKey, 'FrontBox triage: dispatch READY for ' + readyKey);
  if (!readyComment.includes('Gate receipt sha256:')) {
    throw new Error('Unexpected READY comment content: ' + readyComment);
  }
  console.log('[LIVE-6] PASS: Live Forge trigger posted on ' + readyKey + ' -> ' + readyComment);
  console.log('[LIVE-6] Persistent live UAT issue ready for browser inspection: ' + baseUrl + '/browse/' + readyKey);
  console.log('=== FrontBox Live Cloud UAT: ALL CHECKS PASSED ===');
}

run().catch((err) => {
  console.error('Live Cloud UAT failed:', err);
  process.exit(1);
});
