import Claim from '../../models/Claim.js';
import Review from '../../models/Review.js';
import { filterByPermission } from '../permissions/permissionService.js';
import { ApiError } from '../../utils/ApiError.js';
import { getClaim, updateClaim } from './claimService.js';

const actionMap = { approve: 'approved', reject: 'rejected', edit: 'edited', needs_more_evidence: 'needs_more_evidence' };

export async function reviewClaim(claimId, reviewerId, role, input) {
  const claim = await getClaim(claimId, reviewerId, role);
  if (claim.supersededBy) throw new ApiError(409, 'Claim version has been superseded', 'CLAIM_VERSION_SUPERSEDED');
  const pendingWithValidCitations = claim.status === 'pending' && claim.verification?.citationCheck?.valid === true;
  const blockedVerification = ['unsupported', 'missing_evidence', 'conflicting'].includes(claim.status)
    || (claim.status === 'pending' && !pendingWithValidCitations);
  if (input.action === 'approve' && blockedVerification) {
    throw new ApiError(409, 'This claim must have valid, non-conflicting evidence before approval', 'CLAIM_NOT_APPROVABLE');
  }

  let reviewedClaim = claim;
  const previousText = claim.text;
  if (input.action === 'edit') {
    const changes = {};
    if (input.text !== undefined) changes.text = input.text;
    if (input.evidenceIds !== undefined) changes.evidenceIds = input.evidenceIds;
    if (input.citations !== undefined) changes.citations = input.citations;
    reviewedClaim = await updateClaim(claimId, reviewerId, role, changes);
  } else {
    const reviewStatus = actionMap[input.action];
    reviewedClaim = await Claim.findOneAndUpdate({ _id: claimId, supersededBy: null }, { $set: { reviewStatus } }, { returnDocument: 'after', runValidators: true }).lean();
    if (!reviewedClaim) throw new ApiError(409, 'Claim version has been superseded', 'CLAIM_VERSION_SUPERSEDED');
  }

  const review = await Review.create({
    caseId: reviewedClaim.caseId,
    claimId: reviewedClaim._id,
    reviewerId,
    action: actionMap[input.action],
    previousText,
    updatedText: input.action === 'edit' ? reviewedClaim.text : null,
    comment: input.comment,
    version: reviewedClaim.version
  });
  return { claim: reviewedClaim, review: review.toObject() };
}

export async function listCaseReviews(caseId, userId, role) {
  const claims = filterByPermission(await Claim.find({ caseId }).select('_id accessLevel').lean(), role);
  if (!claims.length) return [];
  return Review.find({ caseId, claimId: { $in: claims.map((claim) => claim._id) } }).sort({ createdAt: -1 }).lean();
}
