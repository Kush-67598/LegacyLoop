import { getCase } from './caseService.js';
import Claim from '../models/Claim.js';
import Evidence from '../models/Evidence.js';
import { filterByPermission } from './permissions/permissionService.js';
import { hasCurrentPublishedSuccessorHandover } from './handover/handoverService.js';

const terminalReviewStatuses = new Set(['approved', 'rejected']);
const pendingReviewStatuses = new Set(['pending', 'needs_more_evidence']);

export async function getCaseProgress(caseId, userId, role) {
  const handoverCase = await getCase(caseId, userId, role);
  const [caseEvidence, caseClaims] = await Promise.all([
    Evidence.find({ caseId }).lean(),
    Claim.find({ caseId, supersededBy: null }).lean()
  ]);
  const evidence = filterByPermission(caseEvidence, role);
  const claims = filterByPermission(caseClaims, role);
  const verified = claims.filter((claim) => claim.status === 'verified').length;
  const humanApprovedUnverified = claims.filter((claim) => claim.reviewStatus === 'approved' && claim.status !== 'verified').length;
  const pendingReviews = claims.filter((claim) => pendingReviewStatuses.has(claim.reviewStatus)).length;
  const aiVerificationUnavailable = claims.some((claim) => {
    const result = claim.verification?.supportCheck?.result;
    const reason = claim.verification?.supportCheck?.reason ?? '';
    return claim.status === 'needs_ai_review'
      || result === 'needs_ai_review'
      || /AI support verification (?:has not been configured|is unavailable)/i.test(reason);
  });
  const publishedHandover = await hasCurrentPublishedSuccessorHandover(caseId, handoverCase);

  return {
    counts: { evidence: evidence.length, claims: claims.length, verified, humanApprovedUnverified, pendingReviews },
    verification: { aiUnavailable: aiVerificationUnavailable },
    stages: {
      caseCreated: true,
      evidenceCollected: evidence.length > 0,
      claimsExtracted: claims.length > 0,
      claimsVerified: claims.length > 0 && claims.every((claim) => claim.status === 'verified'),
      humanReview: claims.length > 0 && claims.every((claim) => terminalReviewStatuses.has(claim.reviewStatus)),
      handoverReady: publishedHandover
    }
  };
}
