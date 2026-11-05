import { createDispatchService } from '../frontbox/index.js';
import { createForgePorts } from './ports.js';
import { createResolver } from './resolvers.js';
import { createActionHandlers } from './actions.js';
import { createTriggers } from './triggers.js';

// App wiring factory. src/index.js injects the real Forge singletons;
// tests inject fakes and drive the exact handler surface the manifest
// declares, so production wiring cannot drift from tested wiring.
export function createApp({ api, store, route, Resolver, clock }) {
  // Normalize CJS/ESM interop shapes from the Forge bundler. Live logs
  // (2026-11-05) showed @forge/resolver arriving default-wrapped.
  const apiClient = typeof api?.asApp === 'function' ? api : api?.default;
  const storeClient = typeof store?.get === 'function' ? store : (store?.kvs ?? store?.default ?? store);
  const { reader, writer } = createForgePorts({ api: apiClient, store: storeClient, route });
  const service = createDispatchService({
    reader,
    writer,
    clock: clock ?? (() => new Date().toISOString()),
  });
  const resolver = createResolver({ service, store: storeClient, Resolver });
  const actions = createActionHandlers(service);
  const triggers = createTriggers({ service, writer });
  return {
    handler: resolver.getDefinitions(),
    verifySafetySopAndParts: actions.verifySafetySopAndParts,
    matchAndReserveCrew: actions.matchAndReserveCrew,
    triggerStandbyFailover: actions.triggerStandbyFailover,
    verifySceneProofEvidence: actions.verifySceneProofEvidence,
    triageOnCreate: triggers.triageOnCreate,
    failoverSweep: triggers.failoverSweep,
    service,
  };
}
