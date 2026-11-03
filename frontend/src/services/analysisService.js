import { apiRequest } from "@/services/api";

export function analyzeCase(caseId) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/analyze`, { method: "POST" });
}

export function getOwnership(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/ownership`, { method: "GET", signal });
}

export function getContributors(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/contributors`, { method: "GET", signal });
}

export function getOpenWork(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/open-work`, { method: "GET", signal });
}

export function getTimeline(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/timeline`, { method: "GET", signal });
}

export function getFileHistory(caseId, filename, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/git/history?file=${encodeURIComponent(filename)}`, { method: "GET", signal });
}
