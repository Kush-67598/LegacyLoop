import { apiRequest } from "@/services/api";

export function reviewClaim(claimId, values) {
  return apiRequest(`/claims/${encodeURIComponent(claimId)}/review`, { method: "POST", body: JSON.stringify(values) });
}

export function listReviews(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/reviews`, { method: "GET", signal });
}
