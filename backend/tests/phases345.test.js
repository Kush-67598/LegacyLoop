import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import yazl from 'yazl';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import Case from '../src/models/Case.js';
import Evidence from '../src/models/Evidence.js';
import { parseJson } from '../src/services/parsers/jsonParser.js';
import { parseCsv } from '../src/services/parsers/csvParser.js';
import { parseMarkdown } from '../src/services/parsers/markdownParser.js';
import { parseGitRepository } from '../src/services/git/gitParser.js';
import { extractZip } from '../src/services/evidence/zipExtractor.js';
import { analyzeOwnership } from '../src/services/analysis/ownershipAnalyzer.js';
import { analyzeOpenWork } from '../src/services/analysis/openWorkAnalyzer.js';
import { analyzeTimeline } from '../src/services/analysis/timelineAnalyzer.js';
import { analyzeContributors } from '../src/services/analysis/contributorAnalyzer.js';

const identity = 'phase345-owner';
const userId = createHash('sha256').update(identity).digest('hex').slice(0, 24);
let handoverCase;
let scratch;

function createZip(entries) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const chunks = [];
    zip.outputStream.on('data', (chunk) => chunks.push(chunk));
    zip.outputStream.on('error', reject);
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    for (const [name, data] of entries) zip.addBuffer(data, name);
    zip.end();
  });
}

async function directoryEntries(root, current = root) {
  const output = [];
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await directoryEntries(root, absolute));
    else output.push([path.relative(root, absolute), await fs.readFile(absolute)]);
  }
  return output;
}

before(async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Case.deleteMany({ createdBy: userId });
  await Evidence.deleteMany({ caseId: { $in: (await Case.find({ createdBy: userId }).distinct('_id')) } });
  handoverCase = await Case.create({ title: 'Evidence processing fixture', projectName: 'Payments', departingMember: 'Alex', successor: 'Sam', createdBy: userId });
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'legacyloop-tests-'));
});

after(async () => {
  if (handoverCase) {
    await Evidence.deleteMany({ caseId: handoverCase._id });
    await Case.deleteOne({ _id: handoverCase._id });
  }
  if (scratch) await fs.rm(scratch, { recursive: true, force: true });
  await mongoose.disconnect();
});

test('JSON, CSV, and Markdown parsers produce normalized evidence', () => {
  const json = parseJson(Buffer.from(JSON.stringify({ messages: [{ id: 'm1', channel: 'engineering', message: 'Limit retries to three.', author: 'Rae', timestamp: '2026-10-20T10:30:00Z' }] })), 'engineering_chat.json');
  assert.equal(json[0].sourceType, 'chat_message');
  assert.equal(json[0].locator, 'conversation:engineering/message:m1');
  assert.equal(json[0].text, 'Limit retries to three.');
  const slack = parseJson(Buffer.from(JSON.stringify([{ name: 'deployments', messages: [{ ts: '1792492200', user: 'rae', text: 'Deploy after the migration.' }] }])), 'slack.json');
  assert.equal(slack[0].locator, 'conversation:deployments/message:1792492200');
  assert.ok(slack[0].timestamp instanceof Date);
  const csv = parseCsv(Buffer.from('id,title,status\nTASK-101,Finish retry migration,open\n'), 'tasks.csv');
  assert.equal(csv[0].sourceType, 'task');
  assert.equal(csv[0].locator, 'task:TASK-101');
  const markdown = parseMarkdown(Buffer.from('# Decision\nUse bounded retries.'), 'decision.md');
  assert.equal(markdown[0].sourceType, 'markdown_document');
  assert.equal(markdown[0].text, '# Decision\nUse bounded retries.');
});

test('uploads validate file types, save evidence, report duplicates, and retrieve by case', async () => {
  const chat = Buffer.from(JSON.stringify({ messages: [{ id: 'm-101', channel: 'engineering', message: 'Retry at most three times.', author: 'Rae', timestamp: '2026-10-20T10:30:00Z' }] }));
  const first = await request(app).post(`/api/cases/${handoverCase.id}/upload`).set('x-demo-user', identity).attach('files', chat, { filename: 'chat.json', contentType: 'application/json' });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.recordsExtracted, 1);
  assert.equal(first.body.data.recordsSaved, 1);

  const duplicate = await request(app).post(`/api/cases/${handoverCase.id}/upload`).set('x-demo-user', identity).attach('files', chat, { filename: 'chat.json', contentType: 'application/json' });
  assert.equal(duplicate.body.data.recordsSaved, 0);
  assert.equal(duplicate.body.data.duplicateRecordsSkipped, 1);

  const mixed = await request(app).post(`/api/cases/${handoverCase.id}/upload`).set('x-demo-user', identity)
    .attach('files', Buffer.from('not a zip'), { filename: 'repo.zip', contentType: 'application/zip' })
    .attach('files', Buffer.from('x'), { filename: 'payload.exe', contentType: 'application/octet-stream' });
  assert.equal(mixed.status, 207);
  assert.equal(mixed.body.data.unsupportedFiles.length, 2);

  const records = await request(app).get(`/api/cases/${handoverCase.id}/evidence`).set('x-demo-user', identity);
  assert.equal(records.status, 200);
  assert.equal(records.body.data.length, 1);
  assert.equal(records.body.data[0].text, 'Retry at most three times.');
  const byId = await request(app).get(`/api/evidence/${records.body.data[0]._id}`).set('x-demo-user', identity);
  assert.equal(byId.status, 200);
  assert.equal(Object.hasOwn(byId.body.data, 'originalData'), false);

  const sensitive = Buffer.from('# Contact\nEmail alice@example.com; password=hunter2. Call +1 (555) 234-5678.');
  await request(app).post(`/api/cases/${handoverCase.id}/upload`).set('x-demo-user', identity).attach('files', sensitive, { filename: 'contacts.md', contentType: 'text/markdown' });
  const redacted = await Evidence.findOne({ caseId: handoverCase._id, sourceName: 'contacts.md' }).lean();
  assert.equal(redacted.redactionApplied, true);
  assert.ok(redacted.redactionKinds.includes('email'));
  assert.ok(redacted.redactionKinds.includes('credential'));
  assert.ok(redacted.redactionKinds.includes('phone'));
  assert.equal(redacted.text.includes('alice@example.com'), false);
  assert.equal(redacted.text.includes('hunter2'), false);
  const original = await Evidence.findById(redacted._id).select('+originalData').lean();
  assert.match(original.originalData.text, /alice@example.com/);

  const workRecords = Buffer.from(JSON.stringify({ tasks: [{ id: 'TASK-101', title: 'Finish migration', status: 'in progress', assignee: 'Alex', updated_at: '2026-10-20T10:30:00Z' }] }));
  const prs = Buffer.from(JSON.stringify([{ number: 42, title: 'Migration PR', body: 'Review this migration.', state: 'open', merged: false, user: { login: 'Rae' }, updated_at: '2026-09-01T00:00:00Z' }]));
  await request(app).post(`/api/cases/${handoverCase.id}/upload`).set('x-demo-user', identity)
    .attach('files', workRecords, { filename: 'tasks.json', contentType: 'application/json' })
    .attach('files', prs, { filename: 'pull_requests.json', contentType: 'application/json' });
  const analysis = await request(app).post(`/api/cases/${handoverCase.id}/analyze`).set('x-demo-user', identity);
  assert.equal(analysis.status, 200);
  assert.equal(analysis.body.data.openWork.inProgressTasks.length, 1);
  assert.equal(analysis.body.data.openWork.stalePullRequests.length, 1);
});

test('Git ZIP extraction rejects traversal and Git parser extracts real commit evidence', async () => {
  const zipPath = path.join(scratch, 'unsafe.zip');
  const safeZip = await createZip([['file.txt', Buffer.from('bad')]]);
  const traversalZip = Buffer.from(safeZip);
  const safeName = Buffer.from('file.txt');
  const traversalName = Buffer.from('../x.txt');
  for (let offset = traversalZip.indexOf(safeName); offset !== -1; offset = traversalZip.indexOf(safeName, offset + safeName.length)) traversalName.copy(traversalZip, offset);
  await assert.rejects(extractZip(traversalZip, zipPath), /unsafe|traversal|escapes|relative path/i);

  const repository = path.join(scratch, 'payments-service');
  await fs.mkdir(repository, { recursive: true });
  execFileSync('git', ['init', '-q', repository]);
  execFileSync('git', ['-C', repository, 'config', 'user.name', 'Kush']);
  execFileSync('git', ['-C', repository, 'config', 'user.email', 'kush@example.test']);
  await fs.mkdir(path.join(repository, 'src', 'payments'), { recursive: true });
  await fs.writeFile(path.join(repository, 'src', 'payments', 'retry.js'), 'export const retries = 3;\n');
  execFileSync('git', ['-C', repository, 'add', '.']);
  execFileSync('git', ['-C', repository, 'commit', '-q', '-m', 'Add bounded payment retries']);

  const direct = await parseGitRepository(repository, 'payments-service');
  assert.equal(direct.length, 1);
  assert.equal(direct[0].author, 'Kush');
  assert.deepEqual(direct[0].metadata.changedFiles, ['src/payments/retry.js']);
  assert.equal(direct[0].metadata.insertions, 1);

  const archive = await createZip(await directoryEntries(repository));
  const uploaded = await request(app).post(`/api/cases/${handoverCase.id}/upload`).set('x-demo-user', identity).attach('files', archive, { filename: 'payments-service.zip', contentType: 'application/zip' });
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.body.data.recordsSaved, 1);
  const fileHistory = await request(app).get(`/api/cases/${handoverCase.id}/git/history?file=src%2Fpayments%2Fretry.js`).set('x-demo-user', identity);
  assert.equal(fileHistory.status, 200);
  assert.equal(fileHistory.body.data.length, 1);
  const invalidRepo = await request(app).post(`/api/cases/${handoverCase.id}/upload`).set('x-demo-user', identity).attach('files', await createZip([['readme.txt', Buffer.from('no history')]]), { filename: 'no-history.zip', contentType: 'application/zip' });
  assert.equal(invalidRepo.status, 207);
  assert.match(invalidRepo.body.data.failedFiles[0].reason, /Git repository/);
  assert.equal(invalidRepo.body.data.failedFiles[0].reason.includes(scratch), false);
});

test('deterministic analysis finds contributor concentration, unfinished work, and sorted timeline', () => {
  const evidence = [
    { _id: 'g1', sourceType: 'git_commit', author: 'Alex', timestamp: new Date('2026-10-01'), text: 'Retry implementation', metadata: { changedFiles: ['src/payments/retry.js'] } },
    { _id: 'g2', sourceType: 'git_commit', author: 'Alex', timestamp: new Date('2026-10-10'), text: 'Adjust retry implementation', metadata: { changedFiles: ['src/payments/retry.js', 'src/payments/client.js'] } },
    { _id: 't1', sourceType: 'task', author: 'Alex', timestamp: new Date('2026-10-20'), text: 'Finish retry migration', locator: 'task:T-1', metadata: { status: 'in progress', assignee: 'Alex' } },
    { _id: 't2', sourceType: 'task', author: null, timestamp: new Date('2026-10-21'), text: 'Document retry behavior', locator: 'task:T-2', metadata: { status: 'open' } },
    { _id: 'p1', sourceType: 'pull_request', author: 'Alex', timestamp: new Date('2026-09-01'), text: 'Retry migration PR', locator: 'pull_request:42', metadata: { state: 'open', updated_at: '2026-09-01T00:00:00Z' } }
  ];
  const ownership = analyzeOwnership(evidence, { now: new Date('2026-11-01') });
  assert.equal(ownership.length, 1);
  assert.equal(ownership[0].contributors[0].commitCount, 2);
  assert.deepEqual(ownership[0].contributors[0].mostFrequentlyModifiedFiles, ['src/payments/retry.js', 'src/payments/client.js']);
  assert.ok(ownership[0].riskSignals.includes('single_primary_contributor'));
  assert.ok(analyzeContributors(ownership, { departingMember: 'Alex' })[0].riskSignals.includes('departing_member_majority_activity'));

  const work = analyzeOpenWork(evidence, { departingMember: 'Alex', now: new Date('2026-11-01') });
  assert.equal(work.inProgressTasks.length, 1);
  assert.equal(work.unassignedTasks.length, 1);
  assert.equal(work.tasksAssignedToDepartingMember.length, 1);
  assert.equal(work.stalePullRequests.length, 1);
  assert.deepEqual(analyzeTimeline(evidence).map((item) => item.evidenceId), ['p1', 'g1', 'g2', 't1', 't2']);
});
