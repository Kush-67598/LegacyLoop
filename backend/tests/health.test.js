import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
test('health endpoint reports database unavailable when MongoDB is disconnected', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 503); assert.equal(response.body.success, false); assert.equal(response.body.data.database, 'disconnected');
});
