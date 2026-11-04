// Synthetic demo graph (TRAPS T1 fix). A judge installs into an empty
// site, taps Seed once, and gets a full Teamwork Graph slice: incidents,
// JSM Assets equipment, Confluence Safety SOP records, and a standby
// roster. All names and data are invented for this demo.

export const DEMO_NOW = '2026-12-01T09:00:00.000Z';

export function demoSeed() {
  return {
    incidents: [
      { issueKey: 'GRID-101', summary: 'Transformer hum and lights out on Maple Row', hazardClass: 'high-voltage', assetKeyHint: 'AST-TRF-4001' },
      { issueKey: 'GRID-102', summary: 'Fallen feeder line near North Depot', hazardClass: 'high-voltage', assetKeyHint: 'AST-FDR-2200' },
      { issueKey: 'GRID-103', summary: 'Substation alarm at East Yard', hazardClass: 'high-voltage', assetKeyHint: 'AST-SUB-0900' },
      { issueKey: 'GRID-104', summary: 'Switchgear fault at West Ring', hazardClass: 'high-voltage', assetKeyHint: 'AST-SWG-5100' },
      { issueKey: 'ROAD-201', summary: 'Elderly driver stranded after collision on Route 7', hazardClass: 'collision', assetKeyHint: 'AST-VAN-3300' },
    ],
    assetsByIssue: {
      'GRID-101': { assetKey: 'AST-TRF-4001', name: 'Maple Row pole transformer 400 kVA', requiredParts: ['fuse-cutout-15kv', 'insulator-set-a'] },
      'GRID-102': { assetKey: 'AST-FDR-2200', name: 'North Depot feeder span', requiredParts: ['feeder-splice-kit', 'insulator-set-a'] },
      'GRID-103': { assetKey: 'AST-SUB-0900', name: 'East Yard substation bay 9', requiredParts: ['relay-module-r9'] },
      // No van carries this part: GRID-104 must block on spare parts.
      'GRID-104': { assetKey: 'AST-SWG-5100', name: 'West Ring GIS switchgear', requiredParts: ['gis-switch-module'] },
      'ROAD-201': { assetKey: 'AST-VAN-3300', name: 'Roadside assist van unit 33', requiredParts: ['tow-strap-kit', 'first-aid-kit'] },
    },
    sopsByAsset: {
      'AST-TRF-4001': { pageId: 'sop-hv-loto-01', title: 'High-voltage lockout and tagout', signedByAccountId: 'safety-lead-1', signedAt: '2026-11-20T08:00:00.000Z', validUntil: '2027-02-20T08:00:00.000Z' },
      'AST-FDR-2200': { pageId: 'sop-hv-loto-01', title: 'High-voltage lockout and tagout', signedByAccountId: 'safety-lead-1', signedAt: '2026-11-20T08:00:00.000Z', validUntil: '2027-02-20T08:00:00.000Z' },
      // Expired on purpose: GRID-103 must block in the demo.
      'AST-SUB-0900': { pageId: 'sop-sub-bay-09', title: 'Substation bay entry permit', signedByAccountId: 'safety-lead-1', signedAt: '2026-01-10T08:00:00.000Z', validUntil: '2026-06-10T08:00:00.000Z' },
      'AST-SWG-5100': { pageId: 'sop-hv-loto-01', title: 'High-voltage lockout and tagout', signedByAccountId: 'safety-lead-1', signedAt: '2026-11-20T08:00:00.000Z', validUntil: '2027-02-20T08:00:00.000Z' },
      'AST-VAN-3300': { pageId: 'sop-roadside-01', title: 'Roadside scene safety and tow', signedByAccountId: 'safety-lead-2', signedAt: '2026-11-15T08:00:00.000Z', validUntil: '2027-05-15T08:00:00.000Z' },
    },
    roster: [
      // Nearest and qualified for GRID-101. Missing the feeder splice kit,
      // so GRID-102 blocks against this crew until parts match.
      { crewId: 'crew-alpha', displayName: 'Alpha Line Crew', accountId: 'tech-alpha', onShift: true, distanceKm: 4, certifications: ['high-voltage', 'outage'], vanParts: ['fuse-cutout-15kv', 'insulator-set-a', 'relay-module-r9'] },
      { crewId: 'crew-bravo', displayName: 'Bravo Standby Crew', accountId: 'tech-bravo', onShift: true, distanceKm: 11, certifications: ['high-voltage', 'outage', 'collision'], vanParts: ['fuse-cutout-15kv', 'insulator-set-a', 'feeder-splice-kit', 'tow-strap-kit', 'first-aid-kit'] },
      { crewId: 'crew-charlie', displayName: 'Charlie Assist Crew', accountId: 'tech-charlie', onShift: true, distanceKm: 2, certifications: ['collision', 'breakdown'], vanParts: ['tow-strap-kit', 'first-aid-kit'] },
    ],
  };
}

export function demoIntake(issueKey) {
  if (issueKey === 'ROAD-201') {
    return {
      scenario: 'roadside-assist',
      location: 'Route 7 mile 12 northbound shoulder',
      description: 'Two vehicles touched bumpers. Driver is shaken and the car will not start.',
      voiceTranscript: 'I am 81 and my car stopped after a bump. Please send help to Route 7.',
      photoCount: 2,
      hasSceneDiagram: true,
      hazardClass: 'collision',
      equipmentHint: 'AST-VAN-3300',
      contactChannel: 'voice-callback',
      vulnerable: { elderly: true },
      capturedAt: DEMO_NOW,
    };
  }
  return {
    scenario: 'utility-grid',
    location: 'Maple Row 14, pole 7',
    description: 'Loud hum from the pole transformer, then the whole row lost power.',
    voiceTranscript: '',
    photoCount: 2,
    hasSceneDiagram: false,
    hazardClass: 'high-voltage',
    equipmentHint: 'AST-TRF-4001',
    contactChannel: 'sms',
    vulnerable: { medicalDependency: true },
    capturedAt: DEMO_NOW,
  };
}
