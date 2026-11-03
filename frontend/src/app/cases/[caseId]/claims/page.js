import ClaimsWorkspace from "@/components/claims/ClaimsWorkspace";

export default async function ClaimsPage({ params }) {
  const { caseId } = await params;
  return <ClaimsWorkspace caseId={caseId} />;
}
