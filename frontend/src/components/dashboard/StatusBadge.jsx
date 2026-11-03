const statusStyles = {
  created: "border-zinc-500/20 bg-zinc-400/[0.07] text-zinc-400",
  uploading: "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
  processing: "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
  under_review: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
  ready_for_handover: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200",
  completed: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200",
  failed: "border-rose-300/20 bg-rose-300/[0.08] text-rose-200"
};
const statusLabels = {
  created: "Created",
  uploading: "Uploading",
  processing: "Processing",
  under_review: "Under review",
  ready_for_handover: "Ready to hand over",
  completed: "Completed",
  failed: "Failed"
};

export default function StatusBadge({ status }) {
  const normalizedStatus = statusStyles[status] ? status : "created";
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyles[normalizedStatus]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-90 shadow-[0_0_0_3px_rgba(255,255,255,0.035)]" />{statusLabels[normalizedStatus]}</span>;
}
