// Vulnerable Citizen Priority Routing (Volcan and Vesta intake signals).
// Additive, auditable score. Every point carries its reason so a dispatcher
// can explain the lane to the citizen and to an auditor.

const HAZARD_SCORE = {
  'high-voltage': 40,
  fire: 40,
  flooding: 30,
  collision: 30,
  outage: 20,
  breakdown: 15,
  'property-damage': 10,
  unknown: 5,
};

export function routePriority(sealed, waitingMinutes = 0) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => {
    score += points;
    reasons.push({ points, reason });
  };

  const hazardPoints = HAZARD_SCORE[sealed.hazardClass] ?? HAZARD_SCORE.unknown;
  add(hazardPoints, 'Hazard class "' + sealed.hazardClass + '"');

  const v = sealed.vulnerable ?? {};
  if (v.medicalDependency) add(35, 'Medical dependency (powered care or refrigerated medicine)');
  if (v.disability) add(25, 'Citizen with disability needs assisted response');
  if (v.elderly) add(20, 'Elderly citizen');
  if (v.childAlone) add(25, 'Child alone at the scene');
  if (v.noAlternativeContact) add(10, 'No alternative contact channel');
  if (sealed.voiceTranscript && sealed.voiceTranscript.trim() !== '') {
    add(5, 'Voice intake used (Volcan accessible channel)');
  }
  const waitPoints = Math.min(20, Math.floor(Math.max(0, waitingMinutes) / 15) * 5);
  if (waitPoints > 0) add(waitPoints, 'Waiting ' + waitingMinutes + ' minutes');

  const isVulnerable = Boolean(v.medicalDependency || v.disability || v.elderly || v.childAlone);
  let lane = 'P2';
  let slaMinutes = 240;
  if (score >= 70 || (isVulnerable && hazardPoints >= 30)) {
    lane = 'P0';
    slaMinutes = 30;
  } else if (score >= 40 || isVulnerable) {
    lane = 'P1';
    slaMinutes = 90;
  }

  return {
    lane,
    score,
    slaMinutes,
    isVulnerable,
    reasons,
    nextAction: lane === 'P0'
      ? 'Dispatch first available verified crew and call the citizen now.'
      : lane === 'P1'
        ? 'Verify safety gate, then reserve the nearest qualified crew.'
        : 'Verify safety gate and queue behind P0 and P1 incidents.',
  };
}

// Queue order for the dispatch board: lane first, then longest wait.
export function compareForQueue(a, b) {
  const laneRank = { P0: 0, P1: 1, P2: 2 };
  const byLane = laneRank[a.routing.lane] - laneRank[b.routing.lane];
  if (byLane !== 0) return byLane;
  return b.routing.score - a.routing.score;
}
