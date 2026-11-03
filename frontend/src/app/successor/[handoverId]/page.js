import SuccessorHandover from "@/components/handover/SuccessorHandover";

export default async function SuccessorPage({ params }) {
  const { handoverId } = await params;
  return <SuccessorHandover handoverId={handoverId} />;
}
