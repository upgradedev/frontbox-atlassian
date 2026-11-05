(function () {
  const SCENARIOS = {
    'GRID-101': {
      key: 'GRID-101',
      vertical: 'Utility Grid (Maple Row Transformer)',
      summary: 'Transformer hum and lights out on Maple Row',
      hazardClass: 'high-voltage',
      lane: 'P0',
      slaMinutes: 15,
      vulnerableNote: 'Medical dependency at Maple Row 14, pole 7 (Volcan/Vesta P0 priority elevation)',
      rawSample: 'Loud hum at Maple Row 14 pole 7, reporter phone +30 694 555 0199 or nikos@example.gr, van plate NIK-4821.',
      redactedSample: 'Loud hum at Maple Row 14 pole 7, reporter phone [REDACTED-PHONE] or [REDACTED-EMAIL], van plate [REDACTED-PLATE].',
      redactionCount: 3,
      evidenceHash: 'sha256:b920ee37394c0d1b8f5a2e4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e',
      asset: { key: 'AST-TRF-4001', name: 'Maple Row pole transformer 400 kVA', parts: ['fuse-cutout-15kv', 'insulator-set-a'] },
      sop: { id: 'sop-hv-loto-01', title: 'High-voltage lockout and tagout', status: 'VALID (Signed by safety-lead-1, valid until 2027-02-20)', ok: true },
      crew: { id: 'crew-alpha', name: 'Alpha Line Crew (crew-alpha, 4 km)', standbyId: 'crew-bravo', standbyName: 'Bravo Standby Crew (crew-bravo, 11 km)', certOk: true, partsOk: true },
      gateAllowed: true,
      receiptHash: 'sha256:9c4b2e81f0a3d5c7b9e1a2f4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4',
      blockedReasons: [],
      spokenReady: 'Request GRID-101. Priority P0, target response 15 minutes. Safety checks pass. Waiting for commander approval or crew accept.',
      ssmlReady: '<speak>Request <say-as interpret-as="characters">GRID</say-as> 101. <break time="250ms"/> Priority P0, target response 15 minutes. <break time="250ms"/> Safety checks pass. Waiting for commander approval or crew accept.</speak>',
      rovoTool: 'verify-safety-sop-and-parts',
      rovoAnswer: 'Incident GRID-101 is READY_FOR_COMMANDER_APPROVAL. Asset AST-TRF-4001, Confluence SOP sop-hv-loto-01, and crew-alpha van parts (fuse-cutout-15kv, insulator-set-a) all pass.'
    },
    'GRID-102': {
      key: 'GRID-102',
      vertical: 'Utility Grid (North Depot Feeder Span)',
      summary: 'Fallen feeder line near North Depot',
      hazardClass: 'high-voltage',
      lane: 'P1',
      slaMinutes: 45,
      vulnerableNote: 'Feeder span outage report (crew-alpha skipped because it lacks feeder-splice-kit; crew-bravo matched at 11 km)',
      rawSample: 'Fallen feeder line near North Depot gate, caller phone +30 210 555 0144.',
      redactedSample: 'Fallen feeder line near North Depot gate, caller phone [REDACTED-PHONE].',
      redactionCount: 1,
      evidenceHash: 'sha256:4a1c8e3b9f2d6a0c5e7b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c',
      asset: { key: 'AST-FDR-2200', name: 'North Depot feeder span', parts: ['feeder-splice-kit', 'insulator-set-a'] },
      sop: { id: 'sop-hv-loto-01', title: 'High-voltage lockout and tagout', status: 'VALID (Signed by safety-lead-1, valid until 2027-02-20)', ok: true },
      crew: { id: 'crew-bravo', name: 'Bravo Standby Crew (crew-bravo, 11 km)', standbyId: 'crew-alpha', standbyName: 'Alpha Line Crew (lacks feeder-splice-kit)', certOk: true, partsOk: true },
      gateAllowed: true,
      receiptHash: 'sha256:3e5f7a9c1b3d5e7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f',
      blockedReasons: [],
      spokenReady: 'Request GRID-102. Safety checks pass. Bravo Standby Crew carries feeder-splice-kit and insulator-set-a. Waiting for commander approval.',
      ssmlReady: '<speak>Request <say-as interpret-as="characters">GRID</say-as> 102. <break time="250ms"/> Safety checks pass. Waiting for commander approval.</speak>',
      rovoTool: 'verify-safety-sop-and-parts',
      rovoAnswer: 'Incident GRID-102 is READY_FOR_COMMANDER_APPROVAL. Nearest crew-alpha (4 km) was automatically skipped because it lacks feeder-splice-kit; crew-bravo (11 km) carries all required parts.'
    },
    'GRID-103': {
      key: 'GRID-103',
      vertical: 'Utility Grid (Expired Confluence Safety SOP)',
      summary: 'Substation alarm at East Yard',
      hazardClass: 'high-voltage',
      lane: 'P1',
      slaMinutes: 45,
      vulnerableNote: 'East Yard substation bay 9 telemetry alert',
      rawSample: 'East Yard substation bay 9 alarm, operator badge 123456789, callback +30 210 777 1234.',
      redactedSample: 'East Yard substation bay 9 alarm, operator badge [REDACTED-ID], callback [REDACTED-PHONE].',
      redactionCount: 2,
      evidenceHash: 'sha256:8b2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d',
      asset: { key: 'AST-SUB-0900', name: 'East Yard substation bay 9', parts: ['relay-module-r9'] },
      sop: { id: 'sop-sub-bay-09', title: 'Substation bay entry permit', status: 'EXPIRED at 2026-06-10T08:00:00.000Z (Blocks dispatch)', ok: false },
      crew: { id: 'crew-alpha', name: 'Alpha Line Crew (crew-alpha, 4 km)', standbyId: 'crew-bravo', standbyName: 'Bravo Standby Crew (crew-bravo, 11 km)', certOk: true, partsOk: true },
      gateAllowed: false,
      receiptHash: 'sha256:3a1e0bd8150c7d9e1b3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b',
      blockedReasons: ['Safety SOP signed and current: SOP sign-off expired at 2026-06-10T08:00:00.000Z.'],
      spokenReady: 'Request GRID-103. Not dispatchable yet: Safety SOP signed and current: SOP sign-off expired at 2026-06-10T08:00:00.000Z.',
      ssmlReady: '<speak>Request <say-as interpret-as="characters">GRID</say-as> 103. <break time="250ms"/> Not dispatchable yet. Safety SOP sign-off expired on June 10, 2026.</speak>',
      rovoTool: 'verify-safety-sop-and-parts',
      rovoAnswer: 'Incident GRID-103 is BLOCKED by the Teamwork Graph gate: Confluence SOP sop-sub-bay-09 (Substation bay entry permit) expired at 2026-06-10T08:00:00.000Z. Renew safety sign-off in Confluence before dispatch.'
    },
    'GRID-104': {
      key: 'GRID-104',
      vertical: 'Utility Grid (Missing Van Spare Part)',
      summary: 'Switchgear fault at West Ring',
      hazardClass: 'high-voltage',
      lane: 'P1',
      slaMinutes: 45,
      vulnerableNote: 'West Ring GIS switchgear fault report',
      rawSample: 'Switchgear fault at West Ring, shift phone +30 210 999 8877.',
      redactedSample: 'Switchgear fault at West Ring, shift phone [REDACTED-PHONE].',
      redactionCount: 1,
      evidenceHash: 'sha256:6c8e0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a4c6e8b0d2f4a6c8e',
      asset: { key: 'AST-SWG-5100', name: 'West Ring GIS switchgear', parts: ['gis-switch-module'] },
      sop: { id: 'sop-hv-loto-01', title: 'High-voltage lockout and tagout', status: 'VALID (Signed by safety-lead-1, valid until 2027-02-20)', ok: true },
      crew: { id: 'crew-alpha', name: 'Alpha Line Crew (crew-alpha, 4 km)', standbyId: 'crew-bravo', standbyName: 'Bravo Standby Crew (crew-bravo, 11 km)', certOk: true, partsOk: false },
      gateAllowed: false,
      receiptHash: 'sha256:5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c',
      blockedReasons: ['Required spare parts on the crew van: Missing: gis-switch-module.'],
      spokenReady: 'Request GRID-104. Not dispatchable yet: Required spare parts on the crew van: Missing: gis-switch-module.',
      ssmlReady: '<speak>Request <say-as interpret-as="characters">GRID</say-as> 104. <break time="250ms"/> Not dispatchable yet. Assigned van is missing spare part gis-switch-module.</speak>',
      rovoTool: 'verify-safety-sop-and-parts',
      rovoAnswer: 'Incident GRID-104 is BLOCKED (wasted 50 km truck roll prevented): Asset AST-SWG-5100 requires spare part gis-switch-module, which is not loaded on any on-shift van.'
    },
    'ROAD-201': {
      key: 'ROAD-201',
      vertical: 'Roadside Assistance (Route 7 Collision)',
      summary: 'Elderly driver stranded after collision on Route 7',
      hazardClass: 'collision',
      lane: 'P0',
      slaMinutes: 15,
      vulnerableNote: '81-year-old elderly driver stranded on Route 7 mile 12 northbound shoulder (Volcan/Vesta P0)',
      rawSample: 'I am 81 and my car stopped after a bump on Route 7 mile 12, plate ZXK-9081, phone +30 697 111 2233.',
      redactedSample: 'I am 81 and my car stopped after a bump on Route 7 mile 12, plate [REDACTED-PLATE], phone [REDACTED-PHONE].',
      redactionCount: 2,
      evidenceHash: 'sha256:2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d4f',
      asset: { key: 'AST-VAN-3300', name: 'Roadside assist van unit 33', parts: ['tow-strap-kit', 'first-aid-kit'] },
      sop: { id: 'sop-roadside-01', title: 'Roadside scene safety and tow', status: 'VALID (Signed by safety-lead-2, valid until 2027-05-15)', ok: true },
      crew: { id: 'crew-charlie', name: 'Charlie Assist Crew (crew-charlie, 2 km)', standbyId: 'crew-bravo', standbyName: 'Bravo Standby Crew (crew-bravo, 11 km)', certOk: true, partsOk: true },
      gateAllowed: true,
      receiptHash: 'sha256:0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2a',
      blockedReasons: [],
      spokenReady: 'Request ROAD-201. Priority P0, target response 15 minutes. Safety checks pass. Waiting for commander approval or crew accept.',
      ssmlReady: '<speak>Request <say-as interpret-as="characters">ROAD</say-as> 201. <break time="250ms"/> Priority P0, target response 15 minutes. <break time="250ms"/> Safety checks pass. Waiting for commander approval or crew accept.</speak>',
      rovoTool: 'verify-scene-proof-evidence',
      rovoAnswer: 'Incident ROAD-201 SceneProof intake is VERIFIED (claimReady=true, 2 PII tokens redacted before storage, scene diagram attached). Nearest crew-charlie (2 km) carries tow-strap-kit and first-aid-kit.'
    }
  };

  let currentKey = 'GRID-101';
  const leaseStateByKey = {};

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setBadge(id, ok, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = ok ? 'chip chip-ready' : 'chip chip-blocked';
  }

  function renderScenario(key) {
    const sc = SCENARIOS[key] || SCENARIOS['GRID-101'];
    currentKey = sc.key;
    const lease = leaseStateByKey[sc.key] || { status: 'NONE' };

    document.querySelectorAll('[data-scenario-btn]').forEach(function (btn) {
      const active = btn.getAttribute('data-scenario-btn') === sc.key;
      btn.className = active ? 'sc-btn sc-btn-active' : 'sc-btn';
    });

    setText('active-key', sc.key + ' - ' + sc.vertical);
    setText('active-summary', sc.summary);
    setBadge('active-gate-chip', sc.gateAllowed, sc.gateAllowed ? 'READY FOR COMMANDER APPROVAL' : 'DISPATCH BLOCKED');

    setText('twg-incident-title', sc.key + ' (' + sc.hazardClass + ')');
    setText('twg-incident-sub', 'Lane ' + sc.lane + ' (' + sc.slaMinutes + ' min SLA)');
    setBadge('twg-incident-badge', true, 'SEALED ' + sc.lane);

    setText('twg-asset-title', sc.asset.key);
    setText('twg-asset-sub', sc.asset.name);
    setBadge('twg-asset-badge', true, 'LINKED');

    setText('twg-sop-title', sc.sop.id);
    setText('twg-sop-sub', sc.sop.title + ' - ' + sc.sop.status);
    setBadge('twg-sop-badge', sc.sop.ok, sc.sop.ok ? 'SOP VALID' : 'SOP EXPIRED');

    setText('twg-parts-title', sc.asset.parts.join(', '));
    setText('twg-parts-sub', sc.crew.partsOk ? 'Loaded on assigned van' : 'Missing on van inventory');
    setBadge('twg-parts-badge', sc.crew.partsOk, sc.crew.partsOk ? 'PARTS ON VAN' : 'PART MISSING');

    let crewNodeText = sc.crew.name;
    let crewBadgeOk = sc.crew.certOk && sc.crew.partsOk;
    let crewBadgeLabel = crewBadgeOk ? 'QUALIFIED' : 'BLOCKED';
    if (lease.status === 'RESERVED') {
      crewNodeText = lease.crewName + ' (Lease active, 15m SLA)';
      crewBadgeOk = true;
      crewBadgeLabel = 'LEASE RESERVED';
    } else if (lease.status === 'ACCEPTED') {
      crewNodeText = lease.crewName + ' (Crew accepted within SLA)';
      crewBadgeOk = true;
      crewBadgeLabel = 'DISPATCHED';
    } else if (lease.status === 'FAILED_OVER') {
      crewNodeText = lease.crewName + ' (Auto-promoted via Standby Failover)';
      crewBadgeOk = true;
      crewBadgeLabel = 'STANDBY PROMOTED';
    }
    setText('twg-crew-title', crewNodeText);
    setText('twg-crew-sub', 'Standby backup: ' + sc.crew.standbyName);
    setBadge('twg-crew-badge', crewBadgeOk, crewBadgeLabel);

    setText('j1-raw', sc.rawSample);
    setText('j1-redacted', sc.redactedSample);
    setText('j1-redactions-count', String(sc.redactionCount) + ' PII tokens redacted before Forge storage');
    setText('j1-vulnerable', sc.vulnerableNote);
    setText('j1-hash', sc.evidenceHash);

    setText('j2-receipt-hash', sc.receiptHash);
    setText('j2-reasons', sc.blockedReasons.length ? sc.blockedReasons.join(' ') : 'All 5 Teamwork Graph checks pass. Ready for hash-bound commander approval.');
    const reserveBtn = document.getElementById('btn-approve-reserve');
    if (reserveBtn) {
      reserveBtn.disabled = !sc.gateAllowed;
      reserveBtn.textContent = sc.gateAllowed
        ? 'Commander Approve & Reserve Primary Crew (' + sc.crew.id + ')'
        : 'Reserve Disabled (Blocked by Teamwork Graph Gate)';
    }

    const acceptBtn = document.getElementById('btn-crew-accept');
    const failoverBtn = document.getElementById('btn-run-failover');
    if (lease.status === 'NONE') {
      setText('j3-lease-status', sc.gateAllowed
        ? 'No active reservation lease yet. Click Commander Approve & Reserve in Journey 2 to start the 15-minute SLA lease.'
        : 'Cannot create a crew lease while the safety gate blocks this incident.');
      if (acceptBtn) acceptBtn.disabled = true;
      if (failoverBtn) failoverBtn.disabled = true;
    } else if (lease.status === 'RESERVED') {
      setText('j3-lease-status', 'LEASE ACTIVE (' + lease.leaseId + '): ' + lease.crewName + ' reserved until ' + lease.acceptBy + '. Choose Happy-Path Crew Ack or simulate 15-minute SLA expiry failover.');
      if (acceptBtn) acceptBtn.disabled = false;
      if (failoverBtn) failoverBtn.disabled = false;
    } else if (lease.status === 'ACCEPTED') {
      setText('j3-lease-status', 'HAPPY PATH COMPLETE (' + lease.leaseId + '): ' + lease.crewName + ' accepted the dispatch within the SLA window. Van is rolling safely.');
      if (acceptBtn) acceptBtn.disabled = true;
      if (failoverBtn) failoverBtn.disabled = true;
    } else if (lease.status === 'FAILED_OVER') {
      setText('j3-lease-status', 'AUTO-FAILOVER EXECUTED (' + lease.leaseId + '): Primary crew missed the 15-minute deadline. Standby ' + lease.crewName + ' promoted automatically. Failover receipt: ' + lease.failoverHash);
      if (acceptBtn) acceptBtn.disabled = false;
      if (failoverBtn) failoverBtn.disabled = true;
    }

    let spoken = sc.spokenReady;
    let ssml = sc.ssmlReady;
    if (lease.status === 'RESERVED') {
      spoken = 'Request ' + sc.key + '. Priority ' + sc.lane + '. Safety checks pass. A qualified field crew is reserved and has 15 minutes to confirm.';
      ssml = '<speak>Request ' + sc.key + '. <break time="250ms"/> Priority ' + sc.lane + '. A qualified field crew is reserved and has 15 minutes to confirm.</speak>';
    } else if (lease.status === 'ACCEPTED') {
      spoken = 'Request ' + sc.key + '. Priority ' + sc.lane + '. A crew has accepted and is on the way.';
      ssml = '<speak>Request ' + sc.key + '. <break time="250ms"/> Priority ' + sc.lane + '. A crew has accepted and is on the way.</speak>';
    } else if (lease.status === 'FAILED_OVER') {
      spoken = 'Request ' + sc.key + '. Priority ' + sc.lane + '. Our standby on-call technician has been automatically promoted and assigned to your request.';
      ssml = '<speak>Request ' + sc.key + '. <break time="250ms"/> Priority ' + sc.lane + '. Our standby on-call technician has been automatically promoted and assigned to your request.</speak>';
    }
    setText('j4-spoken-text', spoken);
    setText('j4-ssml-text', ssml);
    setText('j4-rovo-tool', 'MCP Tool: ' + sc.rovoTool + '({ "issueKey": "' + sc.key + '" })');
    setText('j4-rovo-answer', sc.rovoAnswer);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-scenario-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderScenario(btn.getAttribute('data-scenario-btn'));
      });
    });

    const reserveBtn = document.getElementById('btn-approve-reserve');
    if (reserveBtn) {
      reserveBtn.addEventListener('click', function () {
        const sc = SCENARIOS[currentKey];
        if (!sc || !sc.gateAllowed) return;
        leaseStateByKey[currentKey] = {
          status: 'RESERVED',
          leaseId: 'lease-' + sc.receiptHash.slice(7, 15),
          crewId: sc.crew.id,
          crewName: sc.crew.name,
          acceptBy: '2026-12-01T09:15:00.000Z (15m SLA)'
        };
        renderScenario(currentKey);
      });
    }

    const acceptBtn = document.getElementById('btn-crew-accept');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        const lease = leaseStateByKey[currentKey];
        if (!lease) return;
        lease.status = 'ACCEPTED';
        renderScenario(currentKey);
      });
    }

    const failoverBtn = document.getElementById('btn-run-failover');
    if (failoverBtn) {
      failoverBtn.addEventListener('click', function () {
        const sc = SCENARIOS[currentKey];
        const lease = leaseStateByKey[currentKey];
        if (!sc || !lease) return;
        lease.status = 'FAILED_OVER';
        lease.crewId = sc.crew.standbyId;
        lease.crewName = sc.crew.standbyName;
        lease.failoverHash = 'sha256:failover-' + sc.receiptHash.slice(7, 23);
        renderScenario(currentKey);
      });
    }

    const resetBtn = document.getElementById('btn-reset-sim');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        delete leaseStateByKey[currentKey];
        renderScenario(currentKey);
      });
    }

    const speakBtn = document.getElementById('btn-speak-aloud');
    if (speakBtn) {
      speakBtn.addEventListener('click', function () {
        const text = (document.getElementById('j4-spoken-text') || {}).textContent || '';
        const statusEl = document.getElementById('j4-speech-status');
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function') {
          window.speechSynthesis.cancel();
          const utterance = new window.SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          window.speechSynthesis.speak(utterance);
          if (statusEl) statusEl.textContent = 'Speaking aloud via Web Speech synthesizer: "' + text + '"';
        } else if (statusEl) {
          statusEl.textContent = 'Audio readout preview (speech synthesis unavailable in headless browser): "' + text + '"';
        }
      });
    }

    renderScenario('GRID-101');
    if (typeof fetch === 'function') {
      fetch('api/scenarios.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (liveMap) {
          if (!liveMap || typeof liveMap !== 'object') return;
          Object.keys(liveMap).forEach(function (k) {
            SCENARIOS[k] = Object.assign({}, SCENARIOS[k] || {}, liveMap[k]);
          });
          renderScenario(currentKey);
        })
        .catch(function () {});
    }
  });
})();
