import { apiRequest } from "@/services/api";

export function listCases({ signal } = {}) {
  return apiRequest("/cases", { method: "GET", signal });
}

export function getCase(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}`, { method: "GET", signal });
}

export function getCaseProgress(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/progress`, { method: "GET", signal });
}

export function announceCaseProgressChange(caseId) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("legacyloop:case-progress-changed", { detail: { caseId: String(caseId) } }));
  }
}

export function createCase(values) {
  return apiRequest("/cases", { method: "POST", body: JSON.stringify(values) });
}

export function updateCase(caseId, values) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}`, { method: "PATCH", body: JSON.stringify(values) }).then((result) => {
    announceCaseProgressChange(caseId);
    return result;
  });
}

export function listCaseEvidence(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/evidence`, { method: "GET", signal });
}

export function listCaseClaims(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/claims`, { method: "GET", signal });
}
