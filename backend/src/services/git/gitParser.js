import fs from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';

const gitEnvironment = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_TERMINAL_PROMPT: '0'
};
const MARKER = '__LEGACYLOOP_COMMIT__';

async function findRepository(directory, depth = 0, visited = { count: 0 }) {
  if (depth > 30 || visited.count > 10000) return null;
  visited.count += 1;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.name === '.git' && entry.isDirectory())) return directory;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue;
    const result = await findRepository(path.join(directory, entry.name), depth + 1, visited);
    if (result) return result;
  }
  return null;
}

export async function parseGitRepository(repositoryRoot, sourceName) {
  const repositoryPath = await findRepository(repositoryRoot);
  if (!repositoryPath) throw new Error('ZIP does not contain a Git repository with a .git directory');
  const gitDirectory = path.join(repositoryPath, '.git');
  // Uploaded config can include files outside the archive; alternates and commondir
  // can make Git read objects outside it. These are unnecessary for a local history scan.
  await Promise.all([
    'config', 'config.worktree', 'commondir', 'objects/info/alternates', 'objects/info/http-alternates'
  ].map((relativePath) => fs.rm(path.join(gitDirectory, relativePath), { force: true })));
  const git = simpleGit({ baseDir: repositoryPath, env: gitEnvironment, timeout: { block: 120000 } });
  const valid = await git.raw(['rev-parse', '--is-inside-work-tree']).catch(() => 'false');
  if (valid.trim() !== 'true') throw new Error('ZIP contains an invalid Git repository');

  const log = await git.raw(['log', '--all', `--format=${MARKER}%H%x1f%an%x1f%ae%x1f%aI%x1f%s`, '--numstat', '--no-ext-diff', '--no-textconv']);
  const commits = [];
  let current = null;
  for (const line of log.split('\n')) {
    if (line.startsWith(MARKER)) {
      const [commitHash, author, authorEmail, date, subject] = line.slice(MARKER.length).split('\x1f');
      if (!commitHash || !date || !Number.isFinite(Date.parse(date))) { current = null; continue; }
      current = { commitHash, author, authorEmail, date, subject, changedFiles: [], insertions: 0, deletions: 0 };
      commits.push(current);
      if (commits.length > 20000) throw new Error('Git repository exceeds the 20,000 commit processing limit');
      continue;
    }
    if (!current || !line) continue;
    const [added, removed, ...fileParts] = line.split('\t');
    const filename = fileParts.join('\t');
    if (!filename) continue;
    current.changedFiles.push(filename);
    if (/^\d+$/.test(added)) current.insertions += Number(added);
    if (/^\d+$/.test(removed)) current.deletions += Number(removed);
  }

  return commits.map(({ commitHash, author, authorEmail, date, subject, changedFiles, insertions, deletions }) => ({
    sourceType: 'git_commit', sourceName,
    locator: `commit:${commitHash}`, text: subject || '(no commit message)',
    author: author || authorEmail || null, timestamp: new Date(date), accessLevel: 'team',
    metadata: { commitHash, authorEmail: authorEmail || null, changedFiles, insertions, deletions }
  }));
}
