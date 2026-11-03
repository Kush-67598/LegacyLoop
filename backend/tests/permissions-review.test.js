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
import Review from '../src/models/Review.js';
import User from '../src/models/User.js';

const identity = 'phase7-review-owner';
const reviewerIdentity = 'phase7-independent-reviewer';
const userId = createHash('sha256').update(identity).digest('hex').slice(0, 24);
const reviewerId = createHash('sha256').update(reviewerIdentity).digest('hex').slice(0, 24);
let handoverCase;
let teamEvidence;
let leadsEvidence;
let restrictedEvidence;

async function createEvidence(locator, text, accessLevel) {
  return Evidence.create({ caseId: handoverCase._id, sourceType: 'markdown_document', sourceName: 'permission-fixture.md', locator, text, timestamp: new Date('2026-10-20T10:00:00Z'), accessLevel, hash: createHash('sha256').update(`${locator}:${text}`).digest('hex'), metadata: {} });
}

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Case.deleteMany({ createdBy: userId });
  handoverCase = await Case.create({ title: 'Permission and review test', projectName: 'Payments', departingMember: 'Alex', successor: 'Sam', createdBy: userId });
  teamEvidence = await createEvidence('document:team.md', 'Team-visible evidence for the retries.', 'team');
  leadsEvidence = await createEvidence('document:leads.md', 'Leads-only evidence for the timeout.', 'leads_only');
  restrictedEvidence = await createEvidence('document:restricted.md', 'Restricted evidence for a credential rotation.', 'restricted');
});

after(async () => {
  if (handoverCase) {
    await Review.deleteMany({ caseId: handoverCase._id });
    await Claim.deleteMany({ caseId: handoverCase._id });
    await Evidence.deleteMany({ caseId: handoverCase._id });
    await Case.deleteOne({ _id: handoverCase._id });
  }
  await User.deleteMany({ _id: userId });
  await User.deleteMany({ _id: reviewerId });
  await mongoose.disconnect();
});

test('role-based filtering hides restricted evidence and filters analysis before building reports', async () => {
  const team = await request(app).get(`/api/cases/${handoverCase.id}/evidence`).set('x-demo-user', identity);
  assert.deepEqual(team.body.data.map((item) => item.accessLevel), ['team']);
  const reviewer = await request(app).get(`/api/cases/${handoverCase.id}/evidence`).set('x-demo-user', identity).set('x-demo-role', 'reviewer');
  assert.deepEqual(reviewer.body.data.map((item) => item.accessLevel), ['team', 'leads_only']);
  const admin = await request(app).get(`/api/cases/${handoverCase.id}/evidence`).set('x-demo-user', identity).set('x-demo-role', 'admin');
  assert.equal(admin.body.data.length, 3);

  const restricted = await request(app).get(`/api/evidence/${restrictedEvidence._id}`).set('x-demo-user', identity);
  assert.equal(restricted.status, 403);
  const allowed = await request(app).get(`/api/evidence/${restrictedEvidence._id}`).set('x-demo-user', identity).set('x-demo-role', 'admin');
  assert.equal(allowed.status, 200);

  const timeline = await request(app).get(`/api/cases/${handoverCase.id}/timeline`).set('x-demo-user', identity);
  assert.equal(timeline.body.data.length, 1);
  const reviewerTimeline = await request(app).get(`/api/cases/${handoverCase.id}/timeline`).set('x-demo-user', identity).set('x-demo-role', 'reviewer');
  assert.equal(reviewerTimeline.body.data.length, 2);
});

test('claim restrictions inherit evidence access and claim queries filter by role', async () => {
  const denied = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).send({
    text: 'Restricted credential rotation details.', claimType: 'configuration', evidenceIds: [String(restrictedEvidence._id)],
    citations: [{ evidenceId: String(restrictedEvidence._id), quote: 'Restricted evidence for a credential rotation.' }]
  });
  assert.equal(denied.status, 403);

  const teamClaim = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).send({
    text: 'A team claim.', claimType: 'general', evidenceIds: [String(teamEvidence._id)],
    citations: [{ evidenceId: String(teamEvidence._id), quote: 'Team-visible evidence for the retries.' }]
  });
  const leadsClaim = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).set('x-demo-role', 'reviewer').send({
    text: 'A leads claim.', claimType: 'general', evidenceIds: [String(leadsEvidence._id)],
    citations: [{ evidenceId: String(leadsEvidence._id), quote: 'Leads-only evidence for the timeout.' }]
  });
  assert.equal(leadsClaim.body.data.accessLevel, 'leads_only');

  const teamClaims = await request(app).get(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity);
  assert.deepEqual(teamClaims.body.data.map((claim) => claim.text), ['A team claim.']);
  const reviewerClaims = await request(app).get(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).set('x-demo-role', 'reviewer');
  assert.equal(reviewerClaims.body.data.length, 2);
  const restrictedClaim = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).set('x-demo-role', 'admin').send({
    text: 'Restricted claim.', claimType: 'configuration', evidenceIds: [String(restrictedEvidence._id)],
    citations: [{ evidenceId: String(restrictedEvidence._id), quote: 'Restricted evidence for a credential rotation.' }]
  });
  assert.equal(restrictedClaim.body.data.accessLevel, 'restricted');
  const adminClaims = await request(app).get(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).set('x-demo-role', 'admin');
  assert.equal(adminClaims.body.data.length, 3);
});

test('only reviewers can approve claims; actions are recorded and edits create claim versions', async () => {
  const reviewerMe = await request(app).get('/api/auth/me').set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer');
  assert.equal(reviewerMe.status, 200);
  assert.equal(reviewerMe.body.data.role, 'reviewer');
  assert.equal(Object.hasOwn(reviewerMe.body.data, 'passwordHash'), false);
  const beforeAssignment = await request(app).get(`/api/cases/${handoverCase.id}`).set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer');
  assert.equal(beforeAssignment.status, 404);
  const assigned = await request(app).patch(`/api/cases/${handoverCase.id}`).set('x-demo-user', identity).send({ reviewerIds: [reviewerMe.body.data.id] });
  assert.equal(assigned.status, 200);
  const reviewerCase = await request(app).get(`/api/cases/${handoverCase.id}`).set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer');
  assert.equal(reviewerCase.status, 200);

  const created = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).send({
    text: 'The retry implementation has team evidence.', claimType: 'general', evidenceIds: [String(teamEvidence._id)],
    citations: [{ evidenceId: String(teamEvidence._id), quote: 'Team-visible evidence for the retries.' }]
  });
  const forbidden = await request(app).post(`/api/claims/${created.body.data._id}/review`).set('x-demo-user', identity).send({ action: 'approve' });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error.code, 'ROLE_FORBIDDEN');

  const approved = await request(app).post(`/api/claims/${created.body.data._id}/review`).set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer').send({ action: 'approve', comment: 'Citation checked.' });
  assert.equal(approved.status, 201);
  assert.equal(approved.body.data.claim.reviewStatus, 'approved');
  assert.equal(approved.body.data.review.action, 'approved');

  const edited = await request(app).post(`/api/claims/${created.body.data._id}/review`).set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer').send({ action: 'edit', text: 'Edited claim wording.', comment: 'Clarified phrasing.' });
  assert.equal(edited.status, 201);
  assert.equal(edited.body.data.claim.version, 2);
  assert.equal(edited.body.data.claim.reviewStatus, 'pending');
  assert.equal(edited.body.data.review.previousText, created.body.data.text);
  assert.equal(edited.body.data.review.updatedText, 'Edited claim wording.');

  const reviews = await request(app).get(`/api/cases/${handoverCase.id}/reviews`).set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer');
  assert.equal(reviews.status, 200);
  assert.deepEqual(reviews.body.data.map((review) => review.action).sort(), ['approved', 'edited']);

  const missing = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).send({ text: 'Claim awaiting evidence.', claimType: 'risk' });
  const moreEvidence = await request(app).post(`/api/claims/${missing.body.data._id}/review`).set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer').send({ action: 'needs_more_evidence', comment: 'Please attach a source.' });
  assert.equal(moreEvidence.body.data.claim.reviewStatus, 'needs_more_evidence');
  const rejected = await request(app).post(`/api/claims/${missing.body.data._id}/review`).set('x-demo-user', reviewerIdentity).set('x-demo-role', 'reviewer').send({ action: 'reject', comment: 'Unsupported after review.' });
  assert.equal(rejected.body.data.claim.reviewStatus, 'rejected');
});

test('reviewers cannot approve claims with missing, unsupported, or conflicting verification', async () => {
  const missing = await request(app).post(`/api/cases/${handoverCase.id}/claims`).set('x-demo-user', identity).send({ text: 'No evidence claim.', claimType: 'risk' });
  const response = await request(app).post(`/api/claims/${missing.body.data._id}/review`).set('x-demo-user', identity).set('x-demo-role', 'reviewer').send({ action: 'approve' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CLAIM_NOT_APPROVABLE');
});
