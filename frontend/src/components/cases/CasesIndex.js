"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderKanban, Plus, Search } from "lucide-react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { listCases } from "@/services/caseService";

function dateLabel(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function CasesIndex() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const result = await listCases({ signal });
      setCases(Array.isArray(result) ? result : result?.cases || []);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Unable to load cases.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cases;
    return cases.filter((item) => [item.projectName, item.title, item.departingMember, item.successor].some((value) => value?.toLowerCase().includes(normalized)));
  }, [cases, query]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.13em] text-violet-200/65">Workspace</p><h1 className="text-[26px] font-semibold tracking-[-0.045em] text-zinc-100">All cases</h1><p className="mt-2 text-[12px] text-zinc-500">Handover workspaces you created or were assigned to review.</p></div>
        <Link href="/cases/new" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-violet-300/15 bg-violet-300/[0.08] px-3.5 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-300/[0.13]"><Plus size={14} /> Create case</Link>
      </div>

      <section className="mt-7 overflow-hidden rounded-xl border border-white/[0.065] bg-[#111114]">
        <div className="flex flex-col gap-3 border-b border-white/[0.055] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h2 className="text-[13px] font-semibold text-zinc-200">Case directory</h2><p className="mt-1 text-[10px] text-zinc-600">{loading ? "Loading cases…" : `${filteredCases.length} ${filteredCases.length === 1 ? "case" : "cases"}`}</p></div>
          <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-zinc-500 sm:max-w-[260px]"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search cases" placeholder="Search projects or people" className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-700" /></label>
        </div>
        {error ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><h3 className="text-[13px] font-medium text-zinc-300">Cases couldn’t be loaded</h3><p className="mt-2 max-w-md text-[11px] leading-5 text-zinc-600">{error}</p><button onClick={() => load()} type="button" className="mt-4 rounded-lg border border-white/[0.09] px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/[0.05]">Try again</button></div>
          : loading ? <div role="status" aria-label="Loading cases" className="space-y-3 p-6">{[0, 1, 2].map((item) => <div aria-hidden="true" key={item} className="h-12 animate-pulse rounded-lg bg-white/[0.035]" />)}</div>
            : filteredCases.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-300/[0.05] text-violet-200"><FolderKanban size={19} /></div><h3 className="mt-4 text-[13px] font-medium text-zinc-200">{cases.length ? "No matching cases" : "No handover cases yet"}</h3><p className="mt-1 max-w-sm text-[11px] leading-5 text-zinc-600">{cases.length ? "Try another project or person name." : "Create your first case to begin preserving project knowledge."}</p>{!cases.length && <Link href="/cases/new" className="mt-4 text-[11px] font-medium text-violet-200 hover:text-violet-100">Create a case <ArrowRight className="ml-1 inline" size={12} /></Link>}</div>
              : <div className="subtle-scrollbar overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr className="border-b border-white/[0.045] text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600"><th className="px-6 py-3">Project</th><th className="px-4 py-3">Departing member</th><th className="px-4 py-3">Successor</th><th className="px-4 py-3">Status</th><th className="px-6 py-3 text-right">Updated</th><th className="w-10 px-4 py-3" /></tr></thead><tbody className="divide-y divide-white/[0.04]">{filteredCases.map((item) => <tr key={item._id} className="group transition-colors hover:bg-white/[0.018]"><td className="px-6 py-4"><Link href={`/cases/${item._id}`} className="block max-w-[260px]"><span className="block truncate text-[12px] font-medium text-zinc-200 group-hover:text-violet-200">{item.projectName}</span><span className="mt-1 block truncate text-[10px] text-zinc-600">{item.title}</span></Link></td><td className="px-4 py-4 text-[11px] text-zinc-400">{item.departingMember || "—"}</td><td className="px-4 py-4 text-[11px] text-zinc-400">{item.successor || "—"}</td><td className="px-4 py-4"><StatusBadge status={item.status} /></td><td className="px-6 py-4 text-right text-[10px] tabular-nums text-zinc-600">{dateLabel(item.updatedAt)}</td><td className="px-4 py-4 text-zinc-700 group-hover:text-violet-200"><ArrowRight size={14} /></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
