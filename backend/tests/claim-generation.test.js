import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import Case from '../src/models/Case.js';
import Claim from '../src/models/Claim.js';
import ClaimConflict from '../src/models/ClaimConflict.js';
import Evidence from '../src/models/Evidence.js';
import { paymentHandoverEvidence, paymentHandoverGeneratedClaims } from './fixtures/claim-generation-evidence.js';

const owner = `claim-generation-${randomBytes(5).toString('hex')}`;
const ownerId = createHash('sha256').update(owner.toLowerCase()).digest('hex').slice(0, 24);
const originalFetch = globalThis.fetch;
const originalGeminiEnv = Object.fromEntries(['GEMINI_API_KEY', 'GEMINI_MODEL'].map((key) => [key, process.env[key]]));
let handoverCase;
let evidenceRecords;
let claimsFromProvider;
let providerRequests;
let providerDelay = 0;
let providerFailure;
let providerFailureOnRequest = 1;
let providerFailureSequence;

function mockProvider() {
  providerRequests = [];
  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    providerRequests.push({ url: req.url, headers: req.headers, body: await req.clone().json() });
    if (providerDelay) await new Promise((resolve) => setTimeout(resolve, providerDelay));
    const selectedFailure = providerFailureSequence
      ? providerFailureSequence[providerRequests.length - 1]
      : providerFailure && providerRequests.length === providerFailureOnRequest ? providerFailure : undefined;
    if (selectedFailure) return new Response(JSON.stringify(selectedFailure.body), {
      status: selectedFailure.status,
      headers: { 'content-type': 'application/json', ...(selectedFailure.headers ?? {}) }
    });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ claims: claimsFromProvider }) }] }, finishReason: 'STOP' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
}

function configuredAi() {
  process.env.GEMINI_API_KEY = 'test-only-key';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
}

async function callGeneration() {
  return request(app).post(`/api/cases/${handoverCase.id}/claims/generate`)
    .set('x-demo-user', owner)
    .set('x-demo-role', 'reviewer');
}

async function withTemporaryCase(records, run) {
  const previousCase = handoverCase;
  const temporaryCase = await Case.create({ title: 'Temporary claim generation test', projectName: 'Fixture', departingMember: 'Alex', successor: 'Sam', createdBy: ownerId });
  handoverCase = temporaryCase;
  const evidence = await Evidence.create(records.map((record, index) => ({
    ...record,
    caseId: temporaryCase._id,
    hash: createHash('sha256').update(`${temporaryCase.id}:${record.locator}:${record.text}:${index}`).digest('hex'),
    metadata: record.metadata ?? {}
  })));
  try {
    return await run(evidence);
  } finally {
    providerFailure = undefined;
    providerFailureSequence = undefined;
    await ClaimConflict.deleteMany({ caseId: temporaryCase._id });
    await Claim.deleteMany({ caseId: temporaryCase._id });
    await Evidence.deleteMany({ caseId: temporaryCase._id });
    await Case.deleteOne({ _id: temporaryCase._id });
    handoverCase = previousCase;
  }
}

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Claim.init();
  const previousCases = await Case.find({ createdBy: ownerId }).select('_id').lean();
  const previousIds = previousCases.map((record) => record._id);
  await ClaimConflict.deleteMany({ caseId: { $in: previousIds } });
  await Claim.deleteMany({ caseId: { $in: previousIds } });
  await Evidence.deleteMany({ caseId: { $in: previousIds } });
  await Case.deleteMany({ _id: { $in: previousIds } });

  handoverCase = await Case.create({ title: 'Payment knowledge handover', projectName: 'Payments', departingMember: 'Alex', successor: 'Sam', createdBy: ownerId });
  evidenceRecords = await Evidence.create(paymentHandoverEvidence.map((record) => ({
    ...record,
    caseId: handoverCase._id,
    hash: createHash('sha256').update(`${handoverCase.id}:${record.locator}:${record.text}`).digest('hex'),
    metadata: record.metadata
  })));
  claimsFromProvider = paymentHandoverGeneratedClaims(evidenceRecords.map((record) => String(record._id)));
});

after(async () => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalGeminiEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (handoverCase) {
    await ClaimConflict.deleteMany({ caseId: handoverCase._id });
    await Claim.deleteMany({ caseId: handoverCase._id });
    await Evidence.deleteMany({ caseId: handoverCase._id });
    await Case.deleteOne({ _id: handoverCase._id });
  }
  await mongoose.disconnect();
});

test('generation uses deterministic claims when the AI provider is not configured', async () => {
  delete process.env.GEMINI_API_KEY;
  const response = await callGeneration();
  assert.equal(response.status, 200, response.body.message);
  assert.equal(response.body.data.generationMethod, 'RULE_BASED');
  assert.ok(response.body.data.claims.length > 0);
  assert.equal(response.body.data.claims.every((claim) => claim.verification.generation.provider === 'rule_engine'), true);
});

test('rate limits return a useful 429 and do not save claims or retry blindly', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  providerFailure = {
    status: 429,
    headers: { 'retry-after': '12' },
    body: { error: { code: 429, message: 'Rate limit reached', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'RATE_LIMIT_EXCEEDED' }] } }
  };
  mockProvider();
  const response = await callGeneration();
  providerFailure = undefined;
  assert.equal(response.status, 200, response.body.message);
  assert.equal(response.body.data.generationMethods.includes('RULE_BASED'), true);
  assert.equal(providerRequests.length, 3);
  assert.ok((await Claim.countDocuments({ caseId: handoverCase._id })) > 0);
});

test('three Gemini 503 attempts activate deterministic generation for that batch', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  claimsFromProvider = paymentHandoverGeneratedClaims(evidenceRecords.map((record) => String(record._id)));
  const unavailable = { status: 503, body: { error: { code: 503, message: 'Temporarily unavailable', status: 'UNAVAILABLE', details: [] } } };
  providerFailureSequence = [unavailable, unavailable, unavailable];
  mockProvider();
  const response = await callGeneration();
  providerFailureSequence = undefined;
  assert.equal(response.status, 200, response.body.message);
  assert.deepEqual(response.body.data.generationMethods, ['RULE_BASED', 'AI_GENERATED']);
  assert.equal(providerRequests.length, 5);
  assert.equal(providerRequests.slice(0, 3).every(({ url }) => url.includes('/gemini-3.8-flash:')), true);
  assert.ok(response.body.data.claims.some((claim) => claim.verification.generation.method === 'RULE_BASED'));
});

test('a later failed batch falls back locally without losing earlier AI claims', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  claimsFromProvider = paymentHandoverGeneratedClaims(evidenceRecords.map((record) => String(record._id)));
  const unavailable = { status: 503, body: { error: { code: 503, message: 'Temporarily unavailable', status: 'UNAVAILABLE', details: [] } } };
  providerFailureSequence = [undefined, unavailable, unavailable, unavailable];
  mockProvider();
  const response = await callGeneration();
  providerFailureSequence = undefined;
  assert.equal(response.status, 200, response.body.message);
  assert.deepEqual(response.body.data.generationMethods, ['AI_GENERATED', 'RULE_BASED']);
  assert.equal(response.body.data.generatedCount, 5);
  assert.equal(providerRequests.length, 5);
  assert.equal(await Claim.countDocuments({ caseId: handoverCase._id }), 5);
  assert.ok(response.body.data.claims.some((claim) => claim.verification.generation.method === 'AI_GENERATED'));
  assert.ok(response.body.data.claims.some((claim) => claim.verification.generation.method === 'RULE_BASED'));
});

test('authentication errors activate deterministic generation without retrying Gemini', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  claimsFromProvider = paymentHandoverGeneratedClaims(evidenceRecords.map((record) => String(record._id)));
  providerFailureSequence = [{ status: 401, body: { error: { code: 401, message: 'Invalid API key', status: 'UNAUTHENTICATED', details: [] } } }];
  mockProvider();
  const response = await callGeneration();
  providerFailureSequence = undefined;
  assert.equal(response.status, 200, response.body.message);
  assert.equal(response.body.data.generationMethods.includes('RULE_BASED'), true);
  assert.equal(providerRequests.length, 3);
  assert.equal(response.body.data.claims.some((claim) => claim.verification.generation.method === 'RULE_BASED'), true);
});

test('unsupported evidence returns no fabricated claims', async () => {
  await withTemporaryCase([{
    sourceType: 'markdown_document', sourceName: 'notes.md', locator: 'document:notes',
    text: 'blue green orange purple.', accessLevel: 'team', metadata: {}
  }], async () => {
    configuredAi();
    providerFailureSequence = [{ status: 401, body: { error: { code: 401, message: 'Invalid API key', status: 'UNAUTHENTICATED', details: [] } } }];
    mockProvider();
    const response = await callGeneration();
    assert.equal(response.status, 200, response.body.message);
    assert.deepEqual(response.body.data.claims, []);
    assert.match(response.body.data.message, /did not support any new valid claims/i);
    assert.equal(await Claim.countDocuments({ caseId: handoverCase._id }), 0);
  });
});

test('duplicate rule-based facts from separate batches retain citations from both records', async () => {
  const repeated = 'The service is configured with PostgreSQL version 16 for application storage.';
  const inserted = await withTemporaryCase([
    { sourceType: 'markdown_document', sourceName: 'first.md', locator: 'document:first', text: repeated, accessLevel: 'team' },
    { sourceType: 'chat_message', sourceName: 'chat.json', locator: 'message:unrelated', text: 'blue green orange purple.', accessLevel: 'team' },
    { sourceType: 'markdown_document', sourceName: 'third.md', locator: 'document:third', text: repeated, accessLevel: 'team' }
  ], async (evidence) => {
    configuredAi();
    const authFailure = { status: 401, body: { error: { code: 401, message: 'Invalid API key', status: 'UNAUTHENTICATED', details: [] } } };
    providerFailureSequence = [authFailure, authFailure, authFailure];
    mockProvider();
    const response = await callGeneration();
    assert.equal(response.status, 200, response.body.message);
    assert.equal(response.body.data.generatedCount, 1);
    assert.equal(providerRequests.length, 2);
    assert.equal(response.body.data.claims[0].citations.length, 2);
    assert.deepEqual(response.body.data.claims[0].evidenceIds.map(String).sort(), [String(evidence[0]._id), String(evidence[2]._id)].sort());
    return response.body.data.claims[0];
  });
  assert.equal(inserted.verification.generation.method, 'RULE_BASED');
});

test('MongoDB persistence failure does not return a successful generation response', async () => {
  await withTemporaryCase([{
    sourceType: 'markdown_document', sourceName: 'config.md', locator: 'document:config',
    text: 'The service is configured with PostgreSQL version 16 for application storage.', accessLevel: 'team', metadata: {}
  }], async (evidence) => {
    configuredAi();
    claimsFromProvider = [{
      claimText: 'The service is configured with PostgreSQL version 16 for application storage.',
      claimType: 'configuration', confidence: 0.9,
      supportingQuotes: [{ evidenceId: String(evidence[0]._id), quote: evidence[0].text }]
    }];
    mockProvider();
    const originalCreate = Claim.create;
    Claim.create = async () => { throw new Error('simulated MongoDB write failure'); };
    try {
      const response = await callGeneration();
      assert.equal(response.status, 500);
      assert.equal(response.body.success, false);
      assert.equal(response.body.data, undefined);
    } finally {
      Claim.create = originalCreate;
    }
  });
});

test('claims saved from earlier batches remain intact when a later batch is rate limited and falls back locally', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  claimsFromProvider = paymentHandoverGeneratedClaims(evidenceRecords.map((record) => String(record._id)));
  providerFailure = {
    status: 429,
    headers: { 'retry-after': '60' },
    body: { error: { code: 429, message: 'Daily quota exhausted', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'QUOTA_EXHAUSTED' }] } }
  };
  providerFailureOnRequest = 2;
  mockProvider();
  const response = await callGeneration();
  providerFailure = undefined;
  providerFailureOnRequest = 1;
  assert.equal(response.status, 200, response.body.message);
  assert.equal(response.body.data.partial, false);
  assert.equal(response.body.data.generatedCount, 5);
  assert.equal(response.body.data.generationMethods.includes('RULE_BASED'), true);
  assert.equal(providerRequests.length, 3);
  assert.equal(await Claim.countDocuments({ caseId: handoverCase._id }), 5);
});

test('generates evidence-backed claims without mixing production and staging settings', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  await ClaimConflict.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  mockProvider();
  const response = await callGeneration();
  assert.equal(response.status, 200, response.body.message);
  assert.equal(response.body.data.generatedCount, 5);
  assert.equal(response.body.data.skippedCount, 10);
  assert.equal(providerRequests.length, 3);

  const providerRequest = providerRequests[0];
  assert.equal(providerRequest.headers.get('x-goog-api-key'), 'test-only-key');
  assert.match(providerRequest.url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.8-flash:generateContent/);
  assert.equal(providerRequest.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(providerRequest.body.generationConfig.responseJsonSchema.properties.claims.type, 'array');
  const promptData = providerRequests.map((item) => JSON.parse(item.body.contents[0].parts[0].text));
  const restrictedEvidence = evidenceRecords.at(-1);
  assert.equal(promptData.some((batch) => batch.evidence.some((record) => record.evidenceId === String(restrictedEvidence._id))), false);
  assert.equal(JSON.stringify(promptData).includes('confidential acquisition timeline'), false);
  assert.equal(promptData[0].evidence.find((record) => record.evidenceId === String(evidenceRecords[0]._id)).metadata.environment, 'production');
  assert.equal(promptData[1].evidence.find((record) => record.evidenceId === String(evidenceRecords[2]._id)).metadata.environment, 'staging');
  assert.ok(promptData[2].analysis.openWork.unassignedTasks.some((item) => item.evidenceId === String(evidenceRecords[4]._id)));

  const list = await request(app).get(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 5);
  assert.ok(list.body.data.some((claim) => /production.*three/i.test(claim.text)));
  assert.ok(list.body.data.some((claim) => /production.*three.*duplicate charges/i.test(claim.text)));
  assert.ok(list.body.data.some((claim) => /staging.*ten.*not the production/i.test(claim.text)));
  assert.ok(list.body.data.some((claim) => /idempotency.*unfinished/i.test(claim.text)));
  assert.ok(list.body.data.some((claim) => /no assignee|no owner|has no assignee/i.test(claim.text)));
  for (const claim of list.body.data) {
    assert.equal(claim.status, 'pending');
    assert.equal(claim.reviewStatus, 'pending');
    assert.equal(claim.accessLevel, 'team');
    assert.ok(claim.evidenceIds.length > 0);
    assert.ok(claim.citations.length > 0);
    const referenced = new Map(evidenceRecords.map((record) => [String(record._id), record]));
    for (const citation of claim.citations) {
      assert.ok(referenced.has(String(citation.evidenceId)));
      assert.ok(referenced.get(String(citation.evidenceId)).text.replace(/\s+/g, ' ').includes(citation.quote.replace(/\s+/g, ' ').trim()));
    }
  }
  const productionAndStagingClaims = list.body.data.filter((claim) => /retry limit|retries at three|retries to three|staging.*ten/i.test(claim.text));
  assert.ok(productionAndStagingClaims.every((claim) => claim.status === 'pending'));
  assert.equal((await ClaimConflict.countDocuments({ caseId: handoverCase._id })), 0);
});

test('repeated generation skips duplicate claims and retains human review pending', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  await ClaimConflict.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  mockProvider();
  const first = await callGeneration();
  assert.equal(first.status, 200, first.body.message);
  const second = await callGeneration();
  assert.equal(second.status, 200, second.body.message);
  assert.equal(second.body.data.generatedCount, 0);
  assert.equal(second.body.data.skippedCount, 15);
  assert.equal(await Claim.countDocuments({ caseId: handoverCase._id }), 5);
  assert.equal(await Claim.countDocuments({ caseId: handoverCase._id, reviewStatus: 'approved' }), 0);
});

test('a reviewer can explicitly approve a generated pending claim after inspecting its validated citations', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  await ClaimConflict.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  claimsFromProvider = paymentHandoverGeneratedClaims(evidenceRecords.map((record) => String(record._id))).slice(0, 1);
  mockProvider();
  const generated = await callGeneration();
  assert.equal(generated.status, 200);
  assert.equal(generated.body.data.claims[0].status, 'pending');
  assert.equal(generated.body.data.claims[0].reviewStatus, 'pending');

  const reviewed = await request(app).post(`/api/claims/${generated.body.data.claims[0]._id}/review`)
    .set('x-demo-user', owner)
    .set('x-demo-role', 'reviewer')
    .send({ action: 'approve', comment: 'Reviewed the evidence quotation.' });
  assert.equal(reviewed.status, 201, reviewed.body.message);
  assert.equal(reviewed.body.data.claim.reviewStatus, 'approved');
  assert.equal(reviewed.body.data.claim.status, 'pending');
});

test('invalid quotations and unknown evidence references are skipped, and simultaneous requests share one generation', async () => {
  await Claim.deleteMany({ caseId: handoverCase._id });
  await ClaimConflict.deleteMany({ caseId: handoverCase._id });
  configuredAi();
  claimsFromProvider = [
    { claimText: 'A sufficiently long claim with a fabricated quote.', claimType: 'risk', confidence: 0.8, supportingQuotes: [{ evidenceId: String(evidenceRecords[0]._id), quote: 'This sentence does not exist in evidence.' }] },
    { claimText: 'A sufficiently long claim with a foreign evidence ID.', claimType: 'risk', confidence: 0.8, supportingQuotes: [{ evidenceId: 'ffffffffffffffffffffffff', quote: 'No accessible evidence supports this.' }] }
  ];
  mockProvider();
  const invalid = await callGeneration();
  assert.equal(invalid.status, 200, invalid.body.message);
  assert.equal(invalid.body.data.generatedCount, 0);
  assert.equal(invalid.body.data.skippedCount, 6);
  assert.equal(await Claim.countDocuments({ caseId: handoverCase._id }), 0);

  claimsFromProvider = paymentHandoverGeneratedClaims(evidenceRecords.map((record) => String(record._id)));
  providerDelay = 60;
  mockProvider();
  const [left, right] = await Promise.all([callGeneration(), callGeneration()]);
  providerDelay = 0;
  assert.equal(left.status, 200);
  assert.equal(right.status, 200);
  assert.equal(providerRequests.length, 3);
  assert.equal(await Claim.countDocuments({ caseId: handoverCase._id }), 5);
});
