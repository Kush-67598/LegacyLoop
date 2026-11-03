import Evidence from '../../models/Evidence.js';
import { env } from '../../config/env.js';
import { filterByPermission } from '../permissions/permissionService.js';
import { analyzeOwnership } from './ownershipAnalyzer.js';
import { analyzeOpenWork } from './openWorkAnalyzer.js';
import { analyzeTimeline } from './timelineAnalyzer.js';
import { analyzeContributors } from './contributorAnalyzer.js';

export async function generateAnalysis(caseId, { departingMember, stalePrDays = env.stalePrDays, role = 'team_member' } = {}) {
  const records = await Evidence.find({ caseId }).sort({ timestamp: 1, createdAt: 1 }).lean();
  const evidence = filterByPermission(records, role);
  const ownership = analyzeOwnership(evidence);
  return {
    ownership,
    contributors: analyzeContributors(ownership, { departingMember }),
    openWork: analyzeOpenWork(evidence, { departingMember, stalePrDays }),
    timeline: analyzeTimeline(evidence)
  };
}
