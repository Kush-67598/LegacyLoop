import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import Case from '../src/models/Case.js';
import Claim from '../src/models/Claim.js';
import Evidence from '../src/models/Evidence.js';
import Handover from '../src/models/Handover.js';
import User from '../src/models/User.js';

const owner = 'phase8-owner';
const successor = 'phase8-successor';
const admin = 'phase8-admin';
const idFor = (identity) => createHash('sha256').update(identity).digest('hex').slice(0, 24);
let handoverCase;
const evidence = {};
const claims = {};

async function addEvidence(key, text, accessLevel) {
  evidence[key] = await Evidence.create({ caseId: handoverCase._id, sourceType: 'markdown_document', sourceName: `${key}.md`, locator: `document:${key}`, text, accessLevel, hash: createHash('sha256').update(`${key}:${text}`).digest('hex'), metadata: {} });
}
async function addClaim(key, text, accessLevel, reviewStatus = 'approved', status = 'needs_ai_review', quote = text, claimType = 'technical_decision') {
  const source = evidence[key];
  claims[key] = await Claim.create({
    caseId: handoverCase._id, text, claimType, evidenceIds: [source._id],
    citations: [{ evidenceId: source._id, quote }], status, reviewStatus, accessLevel,
    verification: { citationCheck: { result: 'passed' }, supportCheck: { result: 'needs_ai_review' } },
    createdBy: idFor(owner)
  });
}

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Case.deleteMany({ createdBy: idFor(owner) });
  handoverCase = await Case.create({ title: 'Payments handover', description: 'Transfer payment service context.', projectName: 'Payments', departingMember: 'Alex', successor, createdBy: idFor(owner) });
  await addEvidence('team', 'Payment retries are limited to three attempts.', 'team');
  await addEvidence('leads', 'Timeout override is 45 seconds.', 'leads_only');
  await addEvidence('restricted', 'Credential rotation is due on Friday.', 'restricted');
  await addEvidence('pending', 'A pending claim must stay out.', 'team');
  await addEvidence('unsupported', 'No exact quotation should pass.', 'team');
  await addEvidence('conflicting', 'An unresolved conflict stays out.', 'team');
  await addEvidence('gap', 'No documentation explains the retry rollback behavior.', 'team');
  await addEvidence('question', 'Which team owns the payment alert rotation?', 'team');
  await addClaim('team', evidence.team.text, 'team');
  await addClaim('leads', evidence.leads.text, 'leads_only');
  await addClaim('restricted', evidence.restricted.text, 'restricted');
  await addClaim('pending', evidence.pending.text, 'team', 'pending');
  await addClaim('unsupported', 'Unsupported statement.', 'team', 'approved', 'unsupported', 'missing wording');
  await addClaim('conflicting', evidence.conflicting.text, 'team', 'approved', 'conflicting');
  await addClaim('gap', evidence.gap.text, 'team', 'approved', 'needs_ai_review', evidence.gap.text, 'general');
  await addClaim('question', evidence.question.text, 'team', 'approved', 'needs_ai_review', evidence.question.text, 'general');
});

after(async () => {
  if (handoverCase) {
    await Handover.deleteMany({ caseId: handoverCase._id });
    await Claim.deleteMany({ caseId: handoverCase._id });
    await Evidence.deleteMany({ caseId: handoverCase._id });
    await Case.deleteOne({ _id: handoverCase._id });
  }
  await User.deleteMany({ _id: { $in: [idFor(owner), idFor(successor), idFor(admin)] } });
  await mongoose.disconnect();
});

test('handover includes only approved claims and evidence permitted to each viewer', async () => {
  const successorView = await request(app).get(`/api/cases/${handoverCase.id}/handover`).set('x-demo-user', successor).set('x-demo-role', 'successor');
  assert.equal(successorView.status, 200);
  assert.equal(successorView.body.data.role, 'successor');
  assert.equal(successorView.body.data.status, 'published');
  const technical = successorView.body.data.sections.find((section) => section.key === 'technical_decisions');
  assert.equal(technical.items.length, 1);
  assert.equal(technical.items[0].claimId, String(claims.team._id));
  assert.equal(technical.items[0].citations[0].quote, evidence.team.text);
  assert.equal(successorView.body.data.claimIds.length, 3);
  assert.equal(successorView.body.data.sections.find((section) => section.key === 'knowledge_gaps').items.length, 1);
  assert.equal(successorView.body.data.sections.find((section) => section.key === 'unanswered_questions').items.length, 1);
  assert.equal(successorView.body.data.sections.find((section) => section.key === 'project_overview').context.source, 'case_record');

  const reviewerView = await request(app).get(`/api/cases/${handoverCase.id}/handover`).set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(reviewerView.body.data.claimIds.length, 4);
  assert.equal(reviewerView.body.data.claimIds.includes(String(claims.restricted._id)), false);
  const adminView = await request(app).get(`/api/cases/${handoverCase.id}/handover`).set('x-demo-user', admin).set('x-demo-role', 'admin');
  assert.equal(adminView.body.data.claimIds.length, 5);
  for (const section of adminView.body.data.sections) {
    for (const item of section.items) assert.ok(item.citations.length > 0, 'every handover claim must cite evidence');
  }
});

test('successor acknowledgements are stored and update handover status', async () => {
  const view = await request(app).get(`/api/cases/${handoverCase.id}/handover`).set('x-demo-user', successor).set('x-demo-role', 'successor');
  const itemIds = view.body.data.sections.flatMap((section) => section.items.map((item) => item.id));
  const itemId = itemIds[0];
  const unclear = await request(app).post(`/api/handover/${view.body.data._id}/acknowledge`).set('x-demo-user', successor).set('x-demo-role', 'successor').send({ itemId, action: 'unclear', comment: 'Explain the retry rationale.' });
  assert.equal(unclear.status, 200);
  assert.equal(unclear.body.data.status, 'needs_revision');
  for (const remainingId of itemIds.slice(1)) await request(app).post(`/api/handover/${view.body.data._id}/acknowledge`).set('x-demo-user', successor).set('x-demo-role', 'successor').send({ itemId: remainingId, action: 'acknowledge', comment: 'Understood.' });
  const acknowledged = await request(app).post(`/api/handover/${view.body.data._id}/acknowledge`).set('x-demo-user', successor).set('x-demo-role', 'successor').send({ itemId, action: 'acknowledge', comment: 'Understood.' });
  assert.equal(acknowledged.body.data.status, 'acknowledged');
  assert.ok(acknowledged.body.data.acknowledgedAt);
  assert.equal(acknowledged.body.data.acknowledgements.length, itemIds.length + 1);

  const refreshed = await request(app).get(`/api/cases/${handoverCase.id}/handover`).set('x-demo-user', successor).set('x-demo-role', 'successor');
  assert.equal(refreshed.body.data.status, 'acknowledged');
  assert.equal(refreshed.body.data.version, view.body.data.version);
});

test('handover acknowledgement is successor-only and mismatched identities cannot access a case', async () => {
  const stranger = await request(app).get(`/api/cases/${handoverCase.id}/handover`).set('x-demo-user', 'someone-else').set('x-demo-role', 'successor');
  assert.equal(stranger.status, 404);
  const team = await request(app).post('/api/handover/000000000000000000000001/acknowledge').set('x-demo-user', owner);
  assert.equal(team.status, 403);
});
