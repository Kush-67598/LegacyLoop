import { apiRequest } from "@/services/api";
import { announceCaseProgressChange } from "@/services/caseService";

export function generateHandover(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/handover`, { method: "GET", signal }).then((result) => {
    announceCaseProgressChange(caseId);
    return result;
  });
}

export function acknowledgeItem(handoverId, values) {
  return apiRequest(`/handover/${encodeURIComponent(handoverId)}/acknowledge`, { method: "POST", body: JSON.stringify(values) });
}
