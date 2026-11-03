import ReviewQueue from "@/components/review/ReviewQueue";

export default async function ReviewPage({ params }) {
  const { caseId } = await params;
  return <ReviewQueue caseId={caseId} />;
}
