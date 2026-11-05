import { contentHash } from './canonical.js';

// Standby On-Call Roster with time-boxed reservation leases.
// Primary crew misses the accept deadline, the lease expires, and the
// next qualified standby is promoted with a sealed receipt. No phone tree.

export function selectCrew(roster, requirements) {
  const { hazardClass, requiredParts = [], excludeCrewIds = [] } = requirements ?? {};
  const qualified = (roster ?? [])
    .filter((crew) => crew.onShift === true)
    .filter((crew) => !excludeCrewIds.includes(crew.crewId))
    .filter((crew) => (crew.certifications ?? []).includes(hazardClass))
    .filter((crew) => requiredParts.every((part) => (crew.vanParts ?? []).includes(part)))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return qualified[0] ?? null;
}

export function createLease({ issueKey, crew, now, acceptWindowMinutes = 15 }) {
  if (!issueKey || !crew || !crew.crewId || !now) {
    throw new TypeError('createLease requires issueKey, crew.crewId, and now');
  }
  const acceptBy = new Date(new Date(now).getTime() + acceptWindowMinutes * 60_000).toISOString();
  const lease = {
    leaseId: 'lease-' + contentHash({ issueKey, crewId: crew.crewId, now }).slice(7, 19),
    issueKey,
    crewId: crew.crewId,
    status: 'RESERVED',
    version: 1,
    reservedAt: now,
    acceptBy,
    history: [{ at: now, event: 'RESERVED', crewId: crew.crewId }],
  };
  return lease;
}

export function acceptLease(lease, crewId, now) {
  if (lease.status !== 'RESERVED') {
    throw new Error('Lease ' + lease.leaseId + ' is ' + lease.status + ' and cannot be accepted');
  }
  if (lease.crewId !== crewId) {
    throw new Error('Lease ' + lease.leaseId + ' belongs to ' + lease.crewId + ', not ' + crewId);
  }
  if (now > lease.acceptBy) {
    throw new Error('Lease ' + lease.leaseId + ' expired at ' + lease.acceptBy);
  }
  return {
    ...lease,
    status: 'ACCEPTED',
    version: (lease.version ?? 1) + 1,
    acceptedByCrewId: crewId,
    acceptedAt: now,
    history: [...lease.history, { at: now, event: 'ACCEPTED', crewId }],
  };
}

export function failoverIfDue(lease, roster, requirements, now) {
  if (!lease || lease.status !== 'RESERVED' || now <= lease.acceptBy) {
    return { changed: false, lease, receipt: null, reason: 'Failover is not due.' };
  }
  const tried = lease.history.filter((h) => h.event === 'RESERVED' || h.event === 'PROMOTED').map((h) => h.crewId);
  const next = selectCrew(roster, { ...requirements, excludeCrewIds: tried });
  if (!next) {
    const exhausted = {
      ...lease,
      status: 'EXHAUSTED',
      version: (lease.version ?? 1) + 1,
      history: [...lease.history, { at: now, event: 'EXHAUSTED', crewId: lease.crewId }],
    };
    const receiptBody = { leaseId: lease.leaseId, issueKey: lease.issueKey, fromCrewId: lease.crewId, toCrewId: null, at: now, outcome: 'EXHAUSTED' };
    return { changed: true, lease: exhausted, receipt: { ...receiptBody, receiptHash: contentHash(receiptBody) }, reason: 'No qualified standby remains. Commander escalation required.' };
  }
  const acceptBy = new Date(new Date(now).getTime() + 15 * 60_000).toISOString();
  const promoted = {
    ...lease,
    crewId: next.crewId,
    promotedFromCrewId: lease.crewId,
    status: 'RESERVED',
    version: (lease.version ?? 1) + 1,
    acceptBy,
    history: [
      ...lease.history,
      { at: now, event: 'EXPIRED', crewId: lease.crewId },
      { at: now, event: 'PROMOTED', crewId: next.crewId },
    ],
  };
  const receiptBody = { leaseId: lease.leaseId, issueKey: lease.issueKey, fromCrewId: lease.crewId, toCrewId: next.crewId, at: now, outcome: 'FAILED_OVER' };
  return { changed: true, lease: promoted, receipt: { ...receiptBody, receiptHash: contentHash(receiptBody) }, reason: 'Primary crew missed the accept deadline. Standby promoted.' };
}
