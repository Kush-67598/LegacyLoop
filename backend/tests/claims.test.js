import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import Case from '../src/models/Case.js';
import Claim from '../src/models/Claim.js';
import ClaimConflict from '../src/models/ClaimConflict.js';
import Evidence from '../src/models/Evidence.js';

const owner = 'phase6-claim-owner';
const outsider = 'phase6-claim-outsider';
const idFor = (identity) => createHash('sha256').update(identity.toLowerCase()).digest('hex').slice(0, 24);
let handoverCase;
let foreignCase;
let exactEvidence;
let foreignEvidence;

async function addEvidence(caseId, locator, text, accessLevel = 'team') {
  return Evidence.create({ caseId, sourceType: 'markdown_document', sourceName: 'claims-fixture.md', locator, text, accessLevel, hash: createHash('sha256').update(`${caseId}:${locator}:${text}`).digest('hex'), metadata: {} });
}

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Case.deleteMany({ createdBy: { $in: [idFor(owner), idFor(outsider)] } });
  handoverCase = await Case.create({ title: 'Claim test case', projectName: 'Payments', departingMember: 'Alex', successor: 'Sam', createdBy: idFor(owner) });
  foreignCase = await Case.create({ title: 'Other case', projectName: 'Other', departingMember: 'Lee', successor: 'Dana', createdBy: idFor(outsider) });
  exactEvidence = await addEvidence(handoverCase._id, 'document:decision.md', 'Payment retries are limited to three attempts.\nOwners can change this after review.', 'leads_only');
  foreignEvidence = await addEvidence(foreignCase._id, 'document:foreign.md', 'Foreign case evidence quote.', 'team');
});

after(async () => {
  const caseIds = [handoverCase?._id, foreignCase?._id].filter(Boolean);
  await ClaimConflict.deleteMany({ caseId: { $in: caseIds } });
  await Claim.deleteMany({ caseId: { $in: caseIds } });
  await Evidence.deleteMany({ caseId: { $in: caseIds } });
  await Case.deleteMany({ _id: { $in: caseIds } });
  await mongoose.disconnect();
});

test('claim creation validates exact citations and does not claim AI verification', async () => {
  const created = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({
    text: 'Payment retries are capped at three attempts.',
    claimType: 'technical_decision',
    evidenceIds: [String(exactEvidence._id)],
    citations: [{ evidenceId: String(exactEvidence._id), quote: 'Payment retries are limited to three attempts.' }]
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'needs_ai_review');
  assert.equal(created.body.data.reviewStatus, 'pending');
  assert.equal(created.body.data.verification.citationCheck.result, 'passed');
  assert.equal(created.body.data.verification.supportCheck.result, 'needs_ai_review');
  assert.equal(created.body.data.accessLevel, 'leads_only');
});

test('incorrect quotations and absent evidence are persisted as verification failures', async () => {
  const incorrect = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({
    text: 'A claim that is not supported by this quote.', claimType: 'general',
    evidenceIds: [String(exactEvidence._id)], citations: [{ evidenceId: String(exactEvidence._id), quote: 'This phrase is absent.' }]
  });
  assert.equal(incorrect.status, 201);
  assert.equal(incorrect.body.data.status, 'unsupported');
  assert.equal(incorrect.body.data.verification.citationCheck.failures[0].code, 'QUOTE_NOT_FOUND');

  const missing = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({ text: 'No source was provided.', claimType: 'risk' });
  assert.equal(missing.status, 201);
  assert.equal(missing.body.data.status, 'missing_evidence');
  assert.equal(missing.body.data.verification.citationCheck.result, 'missing_evidence');
});

test('claims reject cross-case citations and are hidden from other case owners', async () => {
  const crossCase = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({
    text: 'Do not use cross-case evidence.', claimType: 'general', evidenceIds: [String(foreignEvidence._id)],
    citations: [{ evidenceId: String(foreignEvidence._id), quote: 'Foreign case evidence quote.' }]
  });
  assert.equal(crossCase.status, 400);
  assert.equal(crossCase.body.error.code, 'CROSS_CASE_EVIDENCE');

  const claim = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({ text: 'Private claim.', claimType: 'general' });
  const outsiderRead = await request(app).get(`/api/claims/${claim.body.data._id}`).set('x-demo-user', outsider);
  assert.equal(outsiderRead.status, 404);
});

test('contradictory settings are linked and both claims become conflicting', async () => {
  const claimThree = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({
    text: 'Payment retries are limited to 3 attempts.', claimType: 'technical_decision', evidenceIds: [String(exactEvidence._id)],
    citations: [{ evidenceId: String(exactEvidence._id), quote: 'Payment retries are limited to three attempts.' }]
  });
  const evidenceTen = await addEvidence(handoverCase._id, 'document:other-decision.md', 'Payment retries are limited to 10 attempts.');
  const claimTen = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({
    text: 'Payment retries are limited to 10 attempts.', claimType: 'technical_decision', evidenceIds: [String(evidenceTen._id)],
    citations: [{ evidenceId: String(evidenceTen._id), quote: 'Payment retries are limited to 10 attempts.' }]
  });
  assert.equal(claimThree.body.data.status, 'needs_ai_review');
  assert.equal(claimTen.body.data.status, 'conflicting');
  const refreshedThree = await request(app).get(`/api/claims/${claimThree.body.data._id}`).set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(refreshedThree.body.data.status, 'conflicting');
  assert.equal(refreshedThree.body.data.conflictIds.length, 1);
  const conflictResponse = await request(app).get(`/api/claims/${claimTen.body.data._id}/conflicts`).set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(conflictResponse.status, 200);
  assert.equal(conflictResponse.body.data.length, 1);
  const conflicts = await ClaimConflict.find({ caseId: handoverCase._id }).lean();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].entityKey, 'payment|retry');
});

test('claim PATCH creates a new version and keeps the previous claim', async () => {
  const created = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({ text: 'Initial wording.', claimType: 'general' });
  const updated = await request(app).patch(`/api/claims/${created.body.data._id}`).set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({ text: 'Edited wording.' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.version, 2);
  assert.equal(updated.body.data.text, 'Edited wording.');
  assert.equal(String(updated.body.data.previousVersion), created.body.data._id);
  const previous = await Claim.findById(created.body.data._id).lean();
  assert.equal(previous.text, 'Initial wording.');
  assert.equal(String(previous.supersededBy), String(updated.body.data._id));
  const list = await request(app).get(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(list.body.data.some((claim) => claim._id === created.body.data._id), false);
});
