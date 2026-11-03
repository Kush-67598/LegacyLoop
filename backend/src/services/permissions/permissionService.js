import { ApiError } from '../../utils/ApiError.js';
const ranks = Object.freeze({ team: 0, leads_only: 1, restricted: 2 });
const maximumAccess = Object.freeze({ admin: 'restricted', reviewer: 'leads_only', successor: 'team', team_member: 'team' });
export function canAccessLevel(role, accessLevel) { return (ranks[accessLevel] ?? ranks.restricted) <= ranks[maximumAccess[role] ?? 'team']; }
export function filterByPermission(records, role, getAccessLevel = (record) => record.accessLevel) { return records.filter((record) => canAccessLevel(role, getAccessLevel(record))); }
export function assertCanAccessLevel(role, accessLevel) { if (!canAccessLevel(role, accessLevel)) throw new ApiError(403, 'You do not have access to this information', 'PERMISSION_DENIED'); }
export function inheritAccessLevel(requested, evidence = []) { return evidence.reduce((highest, record) => ranks[record.accessLevel] > ranks[highest] ? record.accessLevel : highest, requested ?? 'team'); }
