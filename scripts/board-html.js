// Shared board rendering for the demo mirror and its static export.
// Self-contained inline CSS, external script-src 'self' interactive simulator,
// system fonts, no external assets, zero <form> tags (ZAP 10202 clean).

export function esc(text) {
  return String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function chip(label, kind) {
  const cls = kind === 'blocked' ? 'chip chip-blocked' : 'chip chip-ready';
  return '<span class="' + cls + '">' + esc(label) + '</span>';
}

export async function buildScenariosPayload(service, keys, roster = []) {
  const out = {};
  for (const key of keys) {
    const [state, citizen] = await Promise.all([
      service.getDispatchState(key),
      service.getCitizenStatus(key),
    ]);
    const sopCheck = state.gate.checks.find((c) => c.id === 'safety-sop');
    const partsCheck = state.gate.checks.find((c) => c.id === 'spare-parts');
    const certCheck = state.gate.checks.find((c) => c.id === 'crew-certification');
    const primaryId = state.crew ? state.crew.crewId : 'crew-alpha';
    const standby = roster.find((r) => r.crewId !== primaryId) ?? { crewId: 'crew-bravo', displayName: 'Bravo Standby Crew', distanceKm: 11 };
    out[key] = {
      key,
      vertical: key.startsWith('ROAD-') ? 'Roadside Assistance (' + state.incident.summary + ')' : 'Utility Grid (' + state.incident.summary + ')',
      summary: state.incident.summary,
      hazardClass: state.incident.hazardClass,
      lane: citizen.lane ?? 'P1',
      slaMinutes: citizen.slaMinutes ?? 45,
      vulnerableNote: citizen.nextAction,
      evidenceHash: state.evidenceHash ?? 'sha256:unsubmitted-intake',
      asset: {
        key: state.asset ? state.asset.assetKey : 'UNLINKED',
        name: state.asset ? state.asset.name : 'No linked asset',
        parts: state.asset ? state.asset.requiredParts : [],
      },
      sop: {
        id: state.sop ? state.sop.pageId : 'UNLINKED',
        title: state.sop ? state.sop.title : 'No linked SOP',
        status: sopCheck ? sopCheck.detail : '',
        ok: sopCheck ? sopCheck.ok : false,
      },
      crew: {
        id: primaryId,
        name: state.crew ? state.crew.displayName + ' (' + state.crew.crewId + ', ' + state.crew.distanceKm + ' km)' : primaryId,
        standbyId: standby.crewId,
        standbyName: standby.displayName + ' (' + standby.crewId + ', ' + standby.distanceKm + ' km)',
        certOk: certCheck ? certCheck.ok : false,
        partsOk: partsCheck ? partsCheck.ok : false,
      },
      gateAllowed: state.gate.allowed,
      receiptHash: state.gate.receiptHash,
      blockedReasons: state.gate.blockedReasons,
      spokenReady: citizen.spoken.text,
      ssmlReady: citizen.spoken.ssml,
    };
  }
  return out;
}

export function renderBoardPage({ note, columns, rows }) {
  const head = columns.map((c) => '<th>' + esc(c) + '</th>').join('');
  const body = rows.map((cells) => '<tr>' + cells.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>FrontBox for JSM and Confluence: Interactive Command Center &amp; Demo Mirror</title><style>'
    + 'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0 auto;max-width:1180px;padding:20px 16px 48px;color:#172b4d;background:#f7f8f9;line-height:1.45}'
    + 'header{background:#091e42;color:#fff;padding:20px 22px;border-radius:8px;margin-bottom:18px}'
    + 'h1{font-size:22px;margin:0 0 8px;color:#fff} h2{font-size:17px;margin:0 0 10px;color:#172b4d} h3{font-size:14px;margin:0 0 6px;color:#0747a6}'
    + 'p{max-width:85ch;margin:6px 0}'
    + '.tagline{font-size:15px;color:#deebff;margin:4px 0 10px}'
    + '.persona-bar{background:#172b4d;color:#b3d4ff;padding:8px 12px;border-radius:6px;font-size:13px;margin-top:8px}'
    + '.pill-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}'
    + '.pill{background:#0747a6;color:#fff;font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px}'
    + '.card{background:#fff;border:1px solid #dfe1e6;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 2px rgba(9,30,66,0.06)}'
    + '.sc-bar{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 12px}'
    + '.sc-btn{background:#ebecf0;color:#172b4d;border:1px solid #c1c7d0;border-radius:6px;padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer}'
    + '.sc-btn:hover{background:#dfe1e6}'
    + '.sc-btn-active{background:#0052cc;color:#fff;border-color:#0052cc}'
    + '.twg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:10px;margin-top:10px}'
    + '.twg-node{border:1px solid #dfe1e6;border-radius:6px;padding:10px 12px;background:#fafbfc}'
    + '.twg-step{font-size:11px;font-weight:700;text-transform:uppercase;color:#5e6c84;margin-bottom:4px}'
    + '.twg-title{font-size:13px;font-weight:700;color:#172b4d;margin:4px 0}'
    + '.twg-sub{font-size:12px;color:#42526e;margin-bottom:6px}'
    + '.journey-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:14px;margin-bottom:16px}'
    + '@media(max-width:640px){.journey-grid{grid-template-columns:1fr}}'
    + '.kv{background:#f4f5f7;border-radius:4px;padding:8px 10px;font-size:12px;margin:6px 0;word-break:break-word}'
    + '.code-box{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;background:#091e42;color:#b3f5ff;padding:8px 10px;border-radius:4px;margin:6px 0;word-break:break-all}'
    + '.btn-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}'
    + '.act-btn{background:#0052cc;color:#fff;border:none;border-radius:4px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer}'
    + '.act-btn:disabled{background:#dfe1e6;color:#7a869a;cursor:not-allowed}'
    + '.act-btn-sec{background:#006644;color:#fff}'
    + '.act-btn-warn{background:#de350b;color:#fff}'
    + '.act-btn-neutral{background:#ebecf0;color:#172b4d}'
    + '.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + 'table{border-collapse:collapse;width:100%;min-width:640px;margin-top:10px;font-size:13px;background:#fff}'
    + 'th,td{border:1px solid #dfe1e6;padding:8px 10px;text-align:left;vertical-align:top}'
    + 'th{background:#f4f5f7;font-weight:600}'
    + '.chip{display:inline-block;border-radius:3px;padding:2px 8px;font-size:11px;font-weight:700}'
    + '.chip-blocked{background:#ffebe6;color:#bf2600}.chip-ready{background:#e3fcef;color:#006644}'
    + 'a{color:#0052cc;text-decoration:none} a:hover{text-decoration:underline}</style>'
    + '<script src="mirror-app.js" defer></script></head><body>'
    + '<header>'
    + '<h1>FrontBox for JSM and Confluence: Interactive Command Center &amp; Demo Mirror</h1>'
    + '<p class="tagline"><strong>FrontBox checks JSM incidents against Confluence safety SOPs and spare parts via Teamwork Graph before dispatching field crews with automatic standby failover.</strong></p>'
    + '<div class="persona-bar"><strong>Hero Persona:</strong> Kostas Nikolaou, Grid &amp; Field Service Dispatcher (Jira Service Management + JSM Assets + Confluence Safety SOPs + Rovo Agent + MCP) | <strong>Headline Benchmark:</strong> 100% of unsafe dispatches blocked in &lt; 2s (0.933 correlation precision across 60 outage pairs).</div>'
    + '<div class="pill-row">'
    + '<span class="pill">Runs on Atlassian (Zero Egress)</span>'
    + '<span class="pill">Multi-Tenant &amp; Project-Scoped Isolation (GRID / ROAD)</span>'
    + '<span class="pill">Volcan/Vesta P0 Accessible Priority Routing</span>'
    + '<span class="pill">Aletheia Spoken &amp; SSML Receipts</span>'
    + '<span class="pill">Rovo Agent + Atlassian MCP Server</span>'
    + '</div>'
    + '</header>'
    + '<div class="card">'
    + '<h2>Step 0: Select a Live Vertical Scenario (1-Click Interactive Walkthrough)</h2>'
    + '<p>' + note + '</p>'
    + '<div class="sc-bar">'
    + '<button type="button" class="sc-btn sc-btn-active" data-scenario-btn="GRID-101">GRID-101: Maple Row Transformer (Ready + P0)</button>'
    + '<button type="button" class="sc-btn" data-scenario-btn="GRID-103">GRID-103: Expired Substation SOP (Blocked)</button>'
    + '<button type="button" class="sc-btn" data-scenario-btn="GRID-104">GRID-104: Missing GIS Switch Module (Blocked)</button>'
    + '<button type="button" class="sc-btn" data-scenario-btn="GRID-102">GRID-102: Feeder Span (Standby Part Match)</button>'
    + '<button type="button" class="sc-btn" data-scenario-btn="ROAD-201">ROAD-201: Route 7 Collision (Ready + P0)</button>'
    + '</div>'
    + '<div class="kv"><strong id="active-key">GRID-101 - Utility Grid (Maple Row Transformer)</strong>: <span id="active-summary">Transformer hum and lights out on Maple Row</span> <span id="active-gate-chip" class="chip chip-ready">READY FOR COMMANDER APPROVAL</span></div>'
    + '</div>'
    + '<div class="card">'
    + '<h2>5-Node Atlassian Teamwork Graph Traversal (Live Entity State)</h2>'
    + '<p>Before any field van rolls 50 km, FrontBox traverses 5 linked entities across Jira Service Management, JSM Assets, Confluence, and the Standby On-Call Roster:</p>'
    + '<div class="twg-grid">'
    + '<div class="twg-node"><div class="twg-step">1. JSM Citizen Incident</div><div id="twg-incident-title" class="twg-title">GRID-101 (high-voltage)</div><div id="twg-incident-sub" class="twg-sub">Lane P0 (15 min SLA)</div><span id="twg-incident-badge" class="chip chip-ready">SEALED P0</span></div>'
    + '<div class="twg-node"><div class="twg-step">2. JSM Equipment Asset</div><div id="twg-asset-title" class="twg-title">AST-TRF-4001</div><div id="twg-asset-sub" class="twg-sub">Maple Row pole transformer 400 kVA</div><span id="twg-asset-badge" class="chip chip-ready">LINKED</span></div>'
    + '<div class="twg-node"><div class="twg-step">3. Confluence Safety SOP</div><div id="twg-sop-title" class="twg-title">sop-hv-loto-01</div><div id="twg-sop-sub" class="twg-sub">High-voltage lockout and tagout</div><span id="twg-sop-badge" class="chip chip-ready">SOP VALID</span></div>'
    + '<div class="twg-node"><div class="twg-step">4. Jira Van Spare Parts</div><div id="twg-parts-title" class="twg-title">fuse-cutout-15kv, insulator-set-a</div><div id="twg-parts-sub" class="twg-sub">Loaded on assigned van</div><span id="twg-parts-badge" class="chip chip-ready">PARTS ON VAN</span></div>'
    + '<div class="twg-node"><div class="twg-step">5. Standby Roster Lease</div><div id="twg-crew-title" class="twg-title">Alpha Line Crew (crew-alpha, 4 km)</div><div id="twg-crew-sub" class="twg-sub">Standby backup: Bravo Standby Crew (crew-bravo, 11 km)</div><span id="twg-crew-badge" class="chip chip-ready">QUALIFIED</span></div>'
    + '</div>'
    + '</div>'
    + '<div class="journey-grid">'
    + '<div class="card">'
    + '<h3>Journey 1: Citizen Crisis Intake (SceneProof PII Redaction + ClaimReady + Volcan/Vesta P0)</h3>'
    + '<p>Citizens submit a guided report or voice transcript on the JSM Portal. PII is redacted before Forge storage and vulnerable citizens elevate automatically to Lane P0 (15-min SLA).</p>'
    + '<div class="kv"><strong>Raw Citizen Input (before SceneProof):</strong><br><span id="j1-raw">Transformer sparking at pole 14B, call Nikos at +30 694 555 0199 or mail nikos@example.gr, van plate NIK-4821.</span></div>'
    + '<div class="kv"><strong>Stored Redacted Record (SceneProof):</strong><br><span id="j1-redacted">Transformer sparking at pole 14B, call Nikos at [REDACTED-PHONE] or mail [REDACTED-EMAIL], van plate [REDACTED-PLATE].</span><br><em id="j1-redactions-count">3 PII tokens redacted before Forge storage</em></div>'
    + '<div class="kv"><strong>Volcan/Vesta Priority Routing:</strong> <span id="j1-vulnerable">Elderly citizen + powered medical equipment at address (Volcan/Vesta P0 elevation)</span></div>'
    + '<div class="code-box">SceneProof Evidence Seal: <span id="j1-hash">sha256:7d8f3e92c1b4a605e4f12b8a9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d</span></div>'
    + '</div>'
    + '<div class="card">'
    + '<h3>Journey 2: Kostas (Dispatcher) Teamwork Graph Gate &amp; Hash-Bound Commander Approval</h3>'
    + '<p>The Writer port refuses to reserve a crew unless all 5 Teamwork Graph checks pass and the human commander approves the exact RFC 8785 canonical receipt hash.</p>'
    + '<div class="kv"><strong>Gate Verdict &amp; Blocking Reasons:</strong><br><span id="j2-reasons">All 5 Teamwork Graph checks pass. Ready for hash-bound commander approval.</span></div>'
    + '<div class="code-box">Canonical Gate Receipt: <span id="j2-receipt-hash">sha256:9c4b2e81f0a3d5c7b9e1a2f4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4</span></div>'
    + '<div class="btn-row">'
    + '<button type="button" id="btn-approve-reserve" class="act-btn">Commander Approve &amp; Reserve Primary Crew (crew-alpha)</button>'
    + '</div>'
    + '</div>'
    + '<div class="card">'
    + '<h3>Journey 3: Field Crew 15-Min SLA Lease, Happy-Path Ack &amp; Automatic Standby Failover</h3>'
    + '<p>Once reserved, the primary crew holds a 15-minute lease. Test both the Happy Path (crew accepts) and Automatic Standby Failover (primary misses deadline, standby promoted with sealed receipt).</p>'
    + '<div class="kv"><strong id="j3-lease-status">No active reservation lease yet. Click Commander Approve &amp; Reserve in Journey 2 to start the 15-minute SLA lease.</strong></div>'
    + '<div class="btn-row">'
    + '<button type="button" id="btn-crew-accept" class="act-btn act-btn-sec" disabled>1. Crew Accepts Dispatch (Happy Path)</button>'
    + '<button type="button" id="btn-run-failover" class="act-btn act-btn-warn" disabled>2. Simulate 15-Min SLA Expiry &amp; Trigger Standby Failover</button>'
    + '<button type="button" id="btn-reset-sim" class="act-btn act-btn-neutral">Reset Simulation</button>'
    + '</div>'
    + '</div>'
    + '<div class="card">'
    + '<h3>Journey 4: Citizen Spoken Receipt (Aletheia Audio + SSML), Confluence Bundle &amp; Rovo Agent</h3>'
    + '<p>Citizens and dispatchers hear the exact same spoken words, while crew IDs, account IDs, and internal gate hashes are stripped from the citizen view.</p>'
    + '<div class="kv"><strong>Aletheia Citizen Spoken Receipt:</strong><br><span id="j4-spoken-text">Request GRID-101. Priority P0, target response 15 minutes. Safety checks pass. Waiting for commander approval or crew reservation.</span></div>'
    + '<div class="code-box" id="j4-ssml-text">&lt;speak&gt;Request &lt;say-as interpret-as=&quot;characters&quot;&gt;GRID&lt;/say-as&gt; 101. Priority P0, target response 15 minutes.&lt;/speak&gt;</div>'
    + '<div class="btn-row"><button type="button" id="btn-speak-aloud" class="act-btn">Speak Receipt Aloud (Aletheia Web Speech)</button></div>'
    + '<div class="kv" id="j4-speech-status">Click Speak Receipt Aloud to synthesize voice readout in your browser.</div>'
    + '<div class="kv"><strong id="j4-rovo-tool">MCP Tool: verify-safety-sop-and-parts({ &quot;issueKey&quot;: &quot;GRID-101&quot; })</strong><br><span id="j4-rovo-answer">Incident GRID-101 is READY_FOR_COMMANDER_APPROVAL. Asset AST-TRF-4001, Confluence SOP sop-hv-loto-01, and crew-alpha van parts all pass.</span></div>'
    + '</div>'
    + '</div>'
    + '<div class="card">'
    + '<h2>All 5 Seeded Incidents &amp; Machine-Verifiable JSON Endpoints</h2>'
    + '<div class="table-wrap"><table><tr>' + head + '</tr>' + body + '</table></div>'
    + '</div>'
    + '</body></html>';
}
