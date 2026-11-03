import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import Case from '../src/models/Case.js';

const owner = 'phase2-owner';
const otherUser = 'phase2-other';
const identityId = (identity) => createHash('sha256').update(identity.toLowerCase()).digest('hex').slice(0, 24);
const ownerId = identityId(owner);
let createdCase;

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Case.deleteMany({ createdBy: { $in: [ownerId, identityId(otherUser)] } });
});

after(async () => {
  await Case.deleteMany({ createdBy: { $in: [ownerId, identityId(otherUser)] } });
  await mongoose.disconnect();
});

test('case creation validates required fields and assigns creator', async () => {
  const invalid = await request(app).post('/api/cases').set('x-demo-user', owner).send({ title: 'Missing fields' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

  const response = await request(app).post('/api/cases').set('x-demo-user', owner).send({
    title: 'Payments handover', projectName: 'Payments', departingMember: 'Alex', successor: 'Sam'
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, 'created');
  assert.equal(String(response.body.data.createdBy), ownerId);
  createdCase = response.body.data;
});

test('case reads, edits, and archives are restricted to the creating identity', async () => {
  assert.ok(createdCase, 'creation test must have produced a case');
  const ownRead = await request(app).get(`/api/cases/${createdCase._id}`).set('x-demo-user', owner);
  assert.equal(ownRead.status, 200);
  assert.equal(ownRead.body.data.title, 'Payments handover');

  const outsiderRead = await request(app).get(`/api/cases/${createdCase._id}`).set('x-demo-user', otherUser);
  assert.equal(outsiderRead.status, 404);

  const outsiderPatch = await request(app).patch(`/api/cases/${createdCase._id}`).set('x-demo-user', otherUser).send({ title: 'Stolen' });
  assert.equal(outsiderPatch.status, 404);

  const ownPatch = await request(app).patch(`/api/cases/${createdCase._id}`).set('x-demo-user', owner).send({ description: 'Transfer context' });
  assert.equal(ownPatch.status, 200);
  assert.equal(ownPatch.body.data.description, 'Transfer context');

  const outsiderList = await request(app).get('/api/cases').set('x-demo-user', otherUser);
  assert.equal(outsiderList.status, 200);
  assert.equal(outsiderList.body.data.some(({ _id }) => _id === createdCase._id), false);

  const archived = await request(app).delete(`/api/cases/${createdCase._id}`).set('x-demo-user', owner);
  assert.equal(archived.status, 200);
  assert.ok(archived.body.data.archivedAt);
  const hidden = await request(app).get(`/api/cases/${createdCase._id}`).set('x-demo-user', owner);
  assert.equal(hidden.status, 404);
  assert.equal((await Case.findById(createdCase._id)).archivedAt instanceof Date, true);
});

test('case endpoints require a demo identity', async () => {
  const response = await request(app).get('/api/cases');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
});
