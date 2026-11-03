export default function MetricCard({ label, value, hint, icon: Icon, accent = "violet", loading }) {
  const accents = {
    violet: { icon: "bg-violet-400/[0.10] text-violet-200", line: "bg-violet-300/70" },
    sky: { icon: "bg-sky-400/[0.09] text-sky-200", line: "bg-sky-300/70" },
    amber: { icon: "bg-amber-300/[0.09] text-amber-200", line: "bg-amber-200/70" },
    emerald: { icon: "bg-emerald-300/[0.09] text-emerald-200", line: "bg-emerald-200/70" }
  };
  return (
    <article aria-busy={loading} className="relative isolate overflow-hidden rounded-lg border border-white/[0.075] bg-[#111114] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-white/[0.15] sm:p-6">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-px ${accents[accent].line}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-[13px] font-medium leading-5 text-zinc-400">{label}</p><div className="mt-5 text-[34px] font-semibold leading-none tracking-[-0.055em] text-zinc-100">{loading ? <span role="status" aria-label={`Loading ${label.toLowerCase()}`} className="inline-block h-8 w-12 animate-pulse rounded bg-white/[0.07] align-middle" /> : value}</div></div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.045] ${accents[accent].icon}`}><Icon size={18} strokeWidth={1.8} /></div>
      </div>
      <div className="mt-4 text-[12px] leading-5 text-zinc-500">{hint}</div>
    </article>
  );
}
