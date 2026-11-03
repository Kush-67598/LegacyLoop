import test from 'node:test';
import assert from 'node:assert/strict';
import { findPotentialConflicts } from '../src/services/claims/conflictDetector.js';

test('production and staging configuration values do not become false conflicts', () => {
  const production = { _id: 'prod', claimType: 'configuration', text: 'Payment module production webhook retry limit is 3.' };
  const staging = { _id: 'stage', claimType: 'configuration', text: 'Payment module staging webhook retry limit is 10.' };
  assert.deepEqual(findPotentialConflicts(staging, [production]), []);
});

test('different values scoped to the same environment remain conflict candidates', () => {
  const production = { _id: 'prod', claimType: 'configuration', text: 'Payment module production webhook retry limit is 3.' };
  const productionChange = { _id: 'prod-change', claimType: 'configuration', text: 'Payment module production webhook retry limit is 10.' };
  const conflicts = findPotentialConflicts(productionChange, [production]);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0].entityKey, /environment:production/);
});
