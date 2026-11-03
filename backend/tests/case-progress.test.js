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

const owner = 'progress-case-owner';
const successor = 'Progress Successor';
const idFor = (identity) => createHash('sha256').update(identity.toLowerCase()).digest('hex').slice(0, 24);
let handoverCase;
const evidence = [];

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Case.deleteMany({ createdBy: idFor(owner) });
  handoverCase = await Case.create({
    title: 'Progress calculation test', projectName: 'Payments', departingMember: 'Alex',
    successor, createdBy: idFor(owner)
  });
  for (let index = 0; index < 17; index += 1) {
    const text = `Evidence record ${index + 1} documents a distinct project fact for dashboard progress validation.`;
    evidence.push(await Evidence.create({
      caseId: handoverCase._id, sourceType: 'markdown_document', sourceName: `record-${index + 1}.md`,
      locator: `document:record-${index + 1}`, text, accessLevel: 'team', metadata: {},
      hash: createHash('sha256').update(`${index}:${text}`).digest('hex')
    }));
  }
  for (let index = 0; index < 21; index += 1) {
    const record = evidence[index % evidence.length];
    await Claim.create({
      caseId: handoverCase._id,
      text: `Project fact ${index + 1} is documented in the uploaded evidence record.`,
      claimType: 'general', evidenceIds: [record._id], citations: [{ evidenceId: record._id, quote: record.text }],
      status: 'needs_ai_review', reviewStatus: index < 17 ? 'approved' : 'rejected', accessLevel: 'team',
      verification: { citationCheck: { valid: true }, supportCheck: { result: 'needs_ai_review' } }
    });
  }
});

after(async () => {
  if (handoverCase) {
    await Handover.deleteMany({ caseId: handoverCase._id });
    await Claim.deleteMany({ caseId: handoverCase._id });
    await Evidence.deleteMany({ caseId: handoverCase._id });
    await Case.deleteOne({ _id: handoverCase._id });
  }
  await User.deleteMany({ _id: { $in: [idFor(owner), idFor(successor)] } });
  await mongoose.disconnect();
});

test('case progress reflects 17 evidence records, 21 reviewed claims, and a current published handover', async () => {
  const published = await request(app).get(`/api/cases/${handoverCase.id}/handover`)
    .set('x-demo-user', successor).set('x-demo-role', 'successor');
  assert.equal(published.status, 200);
  assert.equal(published.body.data.claimIds.length, 17);

  const progress = await request(app).get(`/api/cases/${handoverCase.id}/progress`)
    .set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(progress.status, 200);
  assert.deepEqual(progress.body.data.counts, { evidence: 17, claims: 21, verified: 0, humanApprovedUnverified: 17, pendingReviews: 0 });
  assert.equal(progress.body.data.verification.aiUnavailable, true);
  assert.deepEqual(progress.body.data.stages, {
    caseCreated: true,
    evidenceCollected: true,
    claimsExtracted: true,
    claimsVerified: false,
    humanReview: true,
    handoverReady: true
  });
});

test('a pending review prevents the human-review stage from completing', async () => {
  const record = evidence[0];
  await Claim.create({
    caseId: handoverCase._id, text: 'A final claim remains in the review queue.', claimType: 'general',
    evidenceIds: [record._id], citations: [{ evidenceId: record._id, quote: record.text }],
    status: 'needs_ai_review', reviewStatus: 'pending', accessLevel: 'team',
    verification: { citationCheck: { valid: true }, supportCheck: { result: 'needs_ai_review' } }
  });

  const progress = await request(app).get(`/api/cases/${handoverCase.id}/progress`)
    .set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(progress.status, 200);
  assert.equal(progress.body.data.counts.pendingReviews, 1);
  assert.equal(progress.body.data.stages.humanReview, false);
});

test('new approval makes the published handover stale until it is regenerated', async () => {
  const record = evidence[0];
  const newClaim = await Claim.create({
    caseId: handoverCase._id, text: 'A newly approved project fact is now part of the handover.', claimType: 'general',
    evidenceIds: [record._id], citations: [{ evidenceId: record._id, quote: record.text }],
    status: 'needs_ai_review', reviewStatus: 'pending', accessLevel: 'team',
    verification: { citationCheck: { valid: true }, supportCheck: { result: 'needs_ai_review' } }
  });
  const approval = await request(app).post(`/api/claims/${newClaim._id}/review`)
    .set('x-demo-user', owner).set('x-demo-role', 'reviewer').send({ action: 'approve' });
  assert.equal(approval.status, 201);

  let progress = await request(app).get(`/api/cases/${handoverCase.id}/progress`)
    .set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(progress.body.data.stages.handoverReady, false);

  const regenerated = await request(app).get(`/api/cases/${handoverCase.id}/handover`)
    .set('x-demo-user', successor).set('x-demo-role', 'successor');
  assert.equal(regenerated.status, 200);
  assert.equal(regenerated.body.data.claimIds.length, 18);
  assert.equal(regenerated.body.data.version, 2);

  progress = await request(app).get(`/api/cases/${handoverCase.id}/progress`)
    .set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(progress.body.data.stages.handoverReady, true);
  const historical = await Handover.findOne({ caseId: handoverCase._id, version: 1, role: 'successor' }).lean();
  assert.equal(historical.claimIds.length, 17);
});

test('successful AI verification and a published handover complete both stages', async () => {
  await Claim.updateOne({ caseId: handoverCase._id, text: 'A final claim remains in the review queue.' }, { $set: { reviewStatus: 'rejected' } });
  await Claim.updateMany({ caseId: handoverCase._id }, {
    $set: { status: 'verified', 'verification.supportCheck.result': 'verified', 'verification.supportCheck.reason': 'AI support verification completed.' }
  });

  const published = await request(app).get(`/api/cases/${handoverCase.id}/handover`)
    .set('x-demo-user', successor).set('x-demo-role', 'successor');
  assert.equal(published.status, 200);
  assert.equal(published.body.data.status, 'published');

  const progress = await request(app).get(`/api/cases/${handoverCase.id}/progress`)
    .set('x-demo-user', owner).set('x-demo-role', 'reviewer');
  assert.equal(progress.status, 200);
  assert.equal(progress.body.data.counts.verified, 23);
  assert.equal(progress.body.data.counts.humanApprovedUnverified, 0);
  assert.equal(progress.body.data.verification.aiUnavailable, false);
  assert.equal(progress.body.data.stages.claimsVerified, true);
  assert.equal(progress.body.data.stages.humanReview, true);
  assert.equal(progress.body.data.stages.handoverReady, true);
});
