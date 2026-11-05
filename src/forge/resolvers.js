import { seedDemoWorkspace } from './seed.js';

// UI Kit resolvers. Read functions never touch the Writer. The reserve
// path repeats the full gate check server-side; the panel button state
// is presentation only and is never trusted. The Resolver class is
// injected from src/index.js so definitions run in plain Node tests.
export function createResolver({ service, store, Resolver }) {
  // Bundled Forge code may hand us the CJS interop wrapper
  // ({ default: ResolverClass }) instead of the class itself.
  const ResolverClass = Resolver?.default ?? Resolver;
  if (typeof ResolverClass !== 'function') {
    throw new TypeError('createResolver requires the Resolver class (inject from @forge/resolver in src/index.js)');
  }
  const resolver = new ResolverClass();

  resolver.define('getDispatchState', async ({ payload }) => {
    return service.getDispatchState(payload.issueKey);
  });

  resolver.define('submitIntake', async ({ payload }) => {
    const record = await service.submitIntake(payload.issueKey, payload.intake);
    return {
      ready: record.claim.ready,
      missing: record.claim.missing,
      lane: record.routing.lane,
      slaMinutes: record.routing.slaMinutes,
      nextAction: record.routing.nextAction,
      evidenceHash: record.evidenceHash,
      redactions: record.redactions,
    };
  });

  resolver.define('seedDemo', async () => {
    return seedDemoWorkspace(store);
  });

  resolver.define('approveAndReserve', async ({ payload }) => {
    const result = await service.reserveCrew(payload.issueKey, {
      commanderApproved: payload.commanderApproved === true,
      approvedReceiptHash: payload.approvedReceiptHash,
    });
    return { lease: result.lease, receiptHash: result.receiptHash };
  });

  resolver.define('runFailover', async ({ payload }) => {
    const result = await service.runFailover(payload.issueKey);
    return {
      changed: result.changed,
      reason: result.reason,
      lease: result.lease,
      receipt: result.receipt,
    };
  });

  resolver.define('getEvidenceBundle', async ({ payload }) => {
    return service.getEvidenceBundle(payload.issueKey);
  });

  resolver.define('publishEvidenceBundle', async ({ payload }) => {
    return service.publishEvidenceBundle(payload.issueKey, { spaceId: payload.spaceId ?? '' });
  });

  resolver.define('getCitizenStatus', async ({ payload }) => {
    return service.getCitizenStatus(payload.issueKey);
  });

  return resolver;
}
