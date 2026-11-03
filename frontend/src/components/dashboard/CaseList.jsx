import { ArrowUpRight, FolderKanban } from "lucide-react";
import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function CaseList({ cases, loading, error, onRetry }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.075] bg-[#111114] shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5 sm:px-6">
        <div><h2 className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-100">Recent cases</h2><p className="mt-1.5 text-[12px] leading-5 text-zinc-500">Handover workspaces available to your account</p></div>
        <span className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[12px] font-medium tabular-nums text-zinc-300">{loading ? "—" : cases.length}</span>
      </div>
      {error ? (
        <div className="flex min-h-[230px] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-300/15 bg-rose-300/[0.06] text-rose-200"><FolderKanban size={18} /></div>
          <h3 className="mt-3 text-[14px] font-medium text-zinc-200">Cases couldn’t be loaded</h3>
          <p className="mt-1 max-w-sm text-[12px] leading-5 text-zinc-500">{error}</p>
          <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.07]">Try again</button>
        </div>
      ) : loading ? (
        <div role="status" aria-label="Loading cases" className="divide-y divide-white/[0.04] px-5 sm:px-6">{[0, 1, 2].map((row) => <div key={row} aria-hidden="true" className="flex h-[65px] items-center gap-4"><span className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.05]" /><span className="h-3 w-32 animate-pulse rounded bg-white/[0.05]" /><span className="ml-auto h-5 w-20 animate-pulse rounded-full bg-white/[0.05]" /></div>)}</div>
      ) : cases.length === 0 ? (
        <div className="flex min-h-[248px] flex-col items-center justify-center px-6 text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/[0.07] text-violet-200"><FolderKanban size={20} strokeWidth={1.7} /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-[3px] border-[#111114] bg-violet-300/70" /></div>
          <h3 className="mt-4 text-[15px] font-medium text-zinc-200">No handover cases yet</h3>
          <p className="mt-1 max-w-xs text-[12px] leading-5 text-zinc-500">Cases you create or are assigned to will appear here.</p>
        </div>
      ) : (
        <div className="subtle-scrollbar overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead><tr className="border-b border-white/[0.055] text-[10px] font-semibold uppercase tracking-[0.11em] text-zinc-500"><th className="px-6 py-3.5">Project</th><th className="px-4 py-3.5">Departing member</th><th className="px-4 py-3.5">Successor</th><th className="px-4 py-3.5">Status</th><th className="px-6 py-3.5 text-right">Updated</th></tr></thead>
            <tbody className="divide-y divide-white/[0.05]">{cases.slice(0, 6).map((item) => <tr key={item._id} className="transition-colors hover:bg-white/[0.025]">
              <td className="px-6 py-5"><Link href={`/cases/${item._id}`} className="group block max-w-[250px] rounded-sm focus-visible:outline-offset-2"><div className="truncate text-[14px] font-medium text-zinc-200 group-hover:text-violet-200">{item.projectName}</div><div className="mt-1 truncate text-[12px] text-zinc-500">{item.title}</div></Link></td>
              <td className="px-4 py-5 text-[12px] text-zinc-400">{item.departingMember || "—"}</td><td className="px-4 py-5 text-[12px] text-zinc-400">{item.successor || "—"}</td>
              <td className="px-4 py-5"><StatusBadge status={item.status} /></td><td className="px-6 py-5 text-right text-[11px] tabular-nums text-zinc-500">{formatDate(item.updatedAt)}</td>
            </tr>)}</tbody>
          </table>
          {cases.length > 6 && <div className="border-t border-white/[0.05] px-6 py-3.5 text-[11px] text-zinc-500">Showing the 6 most recent cases</div>}
        </div>
      )}
      {!loading && !error && cases.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-4 sm:px-6"><Link href="/cases" className="text-[12px] font-medium text-violet-200/85 hover:text-violet-100">View all cases</Link><span className="flex items-center gap-1 text-[11px] text-zinc-500">Open a project to view its workspace <ArrowUpRight size={13} /></span></div>}
    </section>
  );
}
