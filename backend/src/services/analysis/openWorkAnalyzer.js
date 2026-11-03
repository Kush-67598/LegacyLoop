const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/[ _-]+/g, ' ');
const OPEN_STATES = new Set(['open', 'new', 'todo', 'to do', 'in progress', 'in review', 'review', 'reopened', 'active', 'draft']);
const CLOSED_STATES = new Set(['closed', 'done', 'complete', 'completed', 'merged', 'resolved', 'cancelled', 'canceled']);
const personName = (value) => typeof value === 'object' && value ? value.name ?? value.login ?? value.username ?? '' : String(value ?? '');

export function analyzeOpenWork(evidence, { departingMember, stalePrDays = 14, now = new Date() } = {}) {
  const tasks = [];
  const pullRequests = [];
  const staleCutoff = now.getTime() - stalePrDays * 86400000;
  for (const item of evidence) {
    if (!['task', 'pull_request'].includes(item.sourceType)) continue;
    const metadata = item.metadata ?? {};
    const state = normalize(metadata.status ?? metadata.state ?? metadata.workflow_state ?? '');
    const assigned = personName(metadata.assignee ?? metadata.assigned_to ?? metadata.owner);
    const updated = new Date(metadata.updated_at ?? metadata.updatedAt ?? metadata.updated ?? item.timestamp ?? 0);
    const base = { evidenceId: String(item._id), locator: item.locator, title: item.text, state: state || 'unknown', assignee: assigned || null, timestamp: item.timestamp ?? null };
    if (item.sourceType === 'task') {
      const isOpen = metadata.closed === true ? false : metadata.closed === false || metadata.completed === false || OPEN_STATES.has(state);
      if (isOpen) tasks.push({ ...base, unassigned: !assigned, assignedToDepartingMember: Boolean(departingMember && assigned.toLowerCase() === departingMember.toLowerCase()), workState: state.includes('progress') ? 'in_progress' : 'open' });
    } else {
      const merged = metadata.merged === true || state === 'merged' || Boolean(metadata.merged_at);
      const closed = metadata.closed === true || state === 'closed' || state === 'resolved';
      const explicitlyOpen = OPEN_STATES.has(state) || metadata.merged === false || metadata.merged_at === null;
      if (!merged && !closed && explicitlyOpen) pullRequests.push({ ...base, merged: false, stale: Number.isFinite(updated.getTime()) && updated.getTime() < staleCutoff, updatedAt: Number.isFinite(updated.getTime()) && updated.getTime() > 0 ? updated.toISOString() : null });
    }
  }
  return { stalePrDays, openTasks: tasks, inProgressTasks: tasks.filter((task) => task.workState === 'in_progress'), unassignedTasks: tasks.filter((task) => task.unassigned), tasksAssignedToDepartingMember: tasks.filter((task) => task.assignedToDepartingMember), unmergedPullRequests: pullRequests, stalePullRequests: pullRequests.filter((pullRequest) => pullRequest.stale) };
}
