import OwnershipWorkspace from "@/components/ownership/OwnershipWorkspace";

export default async function OwnershipPage({ params }) {
  const { caseId } = await params;
  return <OwnershipWorkspace caseId={caseId} />;
}
