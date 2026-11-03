import HandoverWorkspace from "@/components/handover/HandoverWorkspace";

export default async function HandoverPage({ params }) {
  const { caseId } = await params;
  return <HandoverWorkspace caseId={caseId} />;
}
