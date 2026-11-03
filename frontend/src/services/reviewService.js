import { apiRequest } from "@/services/api";
import { announceCaseProgressChange } from "@/services/caseService";

export function reviewClaim(claimId, values) {
  return apiRequest(`/claims/${encodeURIComponent(claimId)}/review`, { method: "POST", body: JSON.stringify(values) }).then((result) => {
    if (result?.claim?.caseId) announceCaseProgressChange(result.claim.caseId);
    return result;
  });
}

export function listReviews(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/reviews`, { method: "GET", signal });
}
