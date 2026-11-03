export default function MetricCard({ label, value, hint, icon: Icon, accent = "violet", loading }) {
  const accents = {
    violet: "bg-violet-400/[0.09] text-violet-200",
    sky: "bg-sky-400/[0.08] text-sky-200",
    amber: "bg-amber-300/[0.08] text-amber-200",
    emerald: "bg-emerald-300/[0.08] text-emerald-200"
  };
  return (
    <article aria-busy={loading} className="rounded-xl border border-white/[0.065] bg-[#111114] p-4 transition-colors hover:border-white/[0.11] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[11px] font-medium text-zinc-500">{label}</p><div className="mt-3 text-[27px] font-semibold leading-none tracking-[-0.055em] text-zinc-100">{loading ? <span role="status" aria-label={`Loading ${label.toLowerCase()}`} className="inline-block h-7 w-10 animate-pulse rounded bg-white/[0.07] align-middle" /> : value}</div></div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accents[accent]}`}><Icon size={17} strokeWidth={1.8} /></div>
      </div>
      <div className="mt-4 text-[10px] text-zinc-600">{hint}</div>
    </article>
  );
}
