import { apiRequest } from "@/services/api";
import { announceCaseProgressChange } from "@/services/caseService";

export function listClaims(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/claims`, { method: "GET", signal });
}

export function generateClaims(caseId) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/claims/generate`, { method: "POST" }).then((result) => {
    announceCaseProgressChange(caseId);
    return result;
  });
}

export function createClaim(caseId, values) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/claims`, { method: "POST", body: JSON.stringify(values) }).then((result) => {
    announceCaseProgressChange(caseId);
    return result;
  });
}

export function getClaim(claimId, { signal } = {}) {
  return apiRequest(`/claims/${encodeURIComponent(claimId)}`, { method: "GET", signal });
}

export function getClaimConflicts(claimId, { signal } = {}) {
  return apiRequest(`/claims/${encodeURIComponent(claimId)}/conflicts`, { method: "GET", signal });
}
