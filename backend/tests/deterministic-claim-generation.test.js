import test from 'node:test';
import assert from 'node:assert/strict';

import { generateDeterministicClaims } from '../src/services/claims/deterministicClaimProvider.js';

const record = (suffix, sourceType, text) => ({
  _id: `0123456789abcdef012345${suffix}`,
  sourceType,
  sourceName: `source-${suffix}`,
  locator: `record:${suffix}`,
  text
});

test('deterministic rules extract all supported categories with exact source citations', () => {
  const evidence = [
    record('01', 'markdown_document', 'Production is configured with PostgreSQL 16.2 for durable storage.'),
    record('02', 'csv_record', 'The worker depends on Redis 7.2 for the job queue.'),
    record('03', 'task', 'TODO: Implement the idempotency guard before release.'),
    record('04', 'chat_message', 'The team selected PostgreSQL because it supports transactional updates.'),
    record('05', 'pull_request', 'The data migration is owned by the release engineering team.'),
    record('06', 'git_commit', 'The retry loop can cause duplicate charges when callbacks repeat.'),
    record('07', 'chat_message', 'We committed to complete the migration by 2026-12-01.'),
    record('08', 'markdown_document', 'The audit service stores project events for seven years.')
  ];

  const result = generateDeterministicClaims(evidence);
  assert.deepEqual(new Set(result.claims.map((claim) => claim.claimType)), new Set([
    'configuration', 'dependency', 'unfinished_work', 'technical_decision',
    'ownership', 'risk', 'commitment', 'general'
  ]));
  assert.equal(result.claims.length, 8);
  for (const claim of result.claims) {
    assert.ok(claim.supportingQuotes.length > 0);
    for (const citation of claim.supportingQuotes) {
      assert.match(citation.evidenceId, /^[a-f\d]{24}$/i);
      const source = evidence.find((item) => String(item._id) === citation.evidenceId);
      assert.ok(source.text.includes(citation.quote));
    }
  }
});

test('duplicate facts merge exact citations from all evidence records', () => {
  const quote = 'The service is configured with PostgreSQL version 16 for application storage.';
  const evidence = [
    record('11', 'markdown_document', quote),
    record('12', 'chat_message', quote)
  ];

  const result = generateDeterministicClaims(evidence);
  assert.equal(result.claims.length, 1);
  assert.equal(result.duplicatesRemoved, 1);
  assert.deepEqual(result.claims[0].supportingQuotes.map((citation) => citation.evidenceId), [
    String(evidence[0]._id), String(evidence[1]._id)
  ]);
});

test('unmeaningful or non-citable evidence yields no claims and does not infer ownership', () => {
  const evidence = [
    record('21', 'git_commit', 'Rae submitted 50 commits for runtime changes.'),
    record('22', 'markdown_document', '# Decisions\n\n- TBD\n- Notes')
  ];

  const result = generateDeterministicClaims(evidence);
  assert.deepEqual(result.claims, []);
});
