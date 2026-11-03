import EvidenceWorkspace from "@/components/evidence/EvidenceWorkspace";

export default async function EvidencePage({ params }) {
  const { caseId } = await params;
  return <EvidenceWorkspace caseId={caseId} />;
}
