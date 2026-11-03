import { apiRequest } from "@/services/api";
import { announceCaseProgressChange } from "@/services/caseService";

export function uploadEvidence(caseId, files) {
  const body = new FormData();
  for (const file of files) body.append("files", file);
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/upload`, { method: "POST", body }).then((result) => {
    announceCaseProgressChange(caseId);
    return result;
  });
}

export function listEvidence(caseId, { signal } = {}) {
  return apiRequest(`/cases/${encodeURIComponent(caseId)}/evidence`, { method: "GET", signal });
}

export function getEvidence(evidenceId, { signal } = {}) {
  return apiRequest(`/evidence/${encodeURIComponent(evidenceId)}`, { method: "GET", signal });
}
