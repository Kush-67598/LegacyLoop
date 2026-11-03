import { apiRequest } from "@/services/api";

export function listClaims(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/claims`, { method: "GET", signal });
}

export function createClaim(caseId, values) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/claims`, { method: "POST", body: JSON.stringify(values) });
}

export function getClaim(claimId, { signal } = {}) {
  return apiRequest(`/claims/${encodeURIComponent(claimId)}`, { method: "GET", signal });
}

export function getClaimConflicts(claimId, { signal } = {}) {
  return apiRequest(`/claims/${encodeURIComponent(claimId)}/conflicts`, { method: "GET", signal });
}
