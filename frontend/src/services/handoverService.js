import { apiRequest } from "@/services/api";

export function generateHandover(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/handover`, { method: "GET", signal });
}

export function acknowledgeItem(handoverId, values) {
  return apiRequest(`/handover/${encodeURIComponent(handoverId)}/acknowledge`, { method: "POST", body: JSON.stringify(values) });
}
