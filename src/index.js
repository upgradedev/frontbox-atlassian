import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import Resolver from '@forge/resolver';
import { createApp } from './forge/app.js';

// Forge entry point. Every manifest handler resolves here. All wiring
// lives in src/forge/app.js (fake-tested); this file only injects the
// real Atlassian singletons. Product rules live in src/frontbox.

const app = createApp({ api, store: kvs, route, Resolver });

export const handler = app.handler;
export const verifySafetySopAndParts = app.verifySafetySopAndParts;
export const matchAndReserveCrew = app.matchAndReserveCrew;
export const triggerStandbyFailover = app.triggerStandbyFailover;
export const verifySceneProofEvidence = app.verifySceneProofEvidence;
export const triageOnCreate = app.triageOnCreate;
export const failoverSweep = app.failoverSweep;
