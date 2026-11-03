import CaseWorkspace from "@/components/cases/CaseWorkspace";

export default async function CaseOverviewPage({ params }) {
  const { caseId } = await params;
  return <CaseWorkspace caseId={caseId} />;
}
