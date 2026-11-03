"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, FileCode2, GitBranch, Users } from "lucide-react";
import { getContributors, getFileHistory, getOwnership } from "@/services/analysisService";
import StatusBadge from "@/components/dashboard/StatusBadge";

const riskLabels = { single_primary_contributor: "Single recorded contributor", low_contributor_diversity: "Low contributor diversity", inactive_module: "Inactive module", missing_decision_documentation: "No linked decision documentation", only_one_recorded_contributor: "Only one recorded contributor", departing_member_majority_activity: "Leaver has majority recorded activity", limited_evidence_of_other_contributor_familiarity: "Little recorded activity from others" };

function formatDate(value) { if (!value || Number.isNaN(new Date(value).getTime())) return "No recorded activity"; return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)); }

export default function OwnershipWorkspace({ caseId }) {
  const [modules, setModules] = useState([]);
  const [contributorRisks, setContributorRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [fileHistory, setFileHistory] = useState(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [fileError, setFileError] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [ownership, contributors] = await Promise.all([getOwnership(caseId, { signal }), getContributors(caseId, { signal })]);
      setModules(Array.isArray(ownership) ? ownership : []);
      setContributorRisks(Array.isArray(contributors) ? contributors : []);
      setSelected((current) => current ? (ownership || []).find((item) => item.module === current.module) || null : null);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Could not load ownership analysis.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [caseId]);

  useEffect(() => { const controller = new AbortController(); Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);

  const risksByModule = useMemo(() => new Map(contributorRisks.map((item) => [item.module, item])), [contributorRisks]);

  async function inspectFile(filename) {
    setSelectedFile(filename);
    setFileError("");
    setFileHistory(null);
    try { setFileHistory(await getFileHistory(caseId, filename)); }
    catch (requestError) { setFileError(requestError.message || "File history could not be loaded."); }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href={`/cases/${caseId}`} className="text-[10px] text-zinc-600 hover:text-zinc-300">Case overview</Link><h1 className="mt-3 text-[25px] font-semibold tracking-[-0.045em] text-zinc-100">Ownership signals</h1><p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-zinc-500">Recorded Git activity grouped by module. Commit counts are indicators of activity, not proof of ownership, expertise or knowledge.</p></div><button type="button" onClick={() => load()} disabled={loading} className="h-9 rounded-lg border border-white/[0.08] px-3 text-[10px] font-medium text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50">{loading ? "Refreshing…" : "Refresh analysis"}</button></div>

      {error && <div role="alert" className="mt-6 flex items-start gap-2 rounded-lg border border-rose-300/10 bg-rose-300/[0.04] p-4 text-[10px] text-rose-200"><AlertCircle size={14} />{error}<button type="button" onClick={() => load()} className="ml-auto underline">Retry</button></div>}
      {loading && <div role="status" aria-label="Loading ownership analysis" className="mt-6 grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((index) => <div key={index} className="h-52 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />)}</div>}
      {!loading && !error && modules.length === 0 && <section className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#111114] px-6 text-center"><GitBranch size={22} className="text-zinc-600" /><h2 className="mt-3 text-[12px] font-medium text-zinc-300">No Git activity to analyze</h2><p className="mt-1 max-w-sm text-[10px] leading-5 text-zinc-600">Upload a repository ZIP containing its .git history. Ownership indicators will be based on parsed commits.</p><Link href={`/cases/${caseId}/evidence`} className="mt-4 text-[10px] text-violet-200">Go to evidence <ArrowUpRight className="ml-1 inline" size={12} /></Link></section>}

      {!loading && !error && modules.length > 0 && <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-3">{modules.map((item) => <ModuleCard key={item.module} item={item} risk={risksByModule.get(item.module)} selected={selected?.module === item.module} onSelect={() => { setSelected(item); setFileHistory(null); setSelectedFile(""); }} />)}</div><aside className="rounded-xl border border-white/[0.065] bg-[#111114] p-5"><div className="flex items-center justify-between"><div><h2 className="text-[12px] font-semibold text-zinc-200">{selected?.module || "Module details"}</h2><p className="mt-1 text-[9px] text-zinc-600">Recorded contributors and files</p></div><Users size={15} className="text-zinc-600" /></div>{!selected ? <p className="mt-8 text-center text-[10px] text-zinc-600">Choose a module to inspect its activity.</p> : <><div className="mt-4 space-y-3">{(selected.contributors || []).map((person) => <div key={person.name} className="rounded-lg border border-white/[0.05] bg-black/10 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-medium text-zinc-300">{person.name}</span><span className="text-[9px] tabular-nums text-zinc-600">{person.commitCount} commits</span></div><p className="mt-1.5 text-[9px] text-zinc-600">{person.filesModified} files · last activity {formatDate(person.lastActivity)}</p></div>)}</div><div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600"><FileCode2 size={12} /> Frequently changed files</h3><div className="space-y-1">{[...new Set((selected.contributors || []).flatMap((person) => person.mostFrequentlyModifiedFiles || []))].map((filename) => <button type="button" key={filename} onClick={() => inspectFile(filename)} className={`block w-full truncate rounded-md px-2 py-2 text-left font-mono text-[9px] ${selectedFile === filename ? "bg-violet-300/[0.07] text-violet-100" : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"}`}>{filename}</button>)}</div></div>{selectedFile && <div className="mt-4 border-t border-white/[0.05] pt-4"><h3 className="truncate text-[9px] font-medium text-zinc-400">History: {selectedFile}</h3>{fileError && <p role="alert" className="mt-2 text-[9px] text-rose-200">{fileError}</p>}{fileHistory && (fileHistory.length ? <ol className="mt-2 space-y-2">{fileHistory.slice(0, 30).map((commit) => <li key={commit._id} className="rounded-md bg-black/10 p-2"><p className="text-[9px] leading-4 text-zinc-300">{commit.text}</p><p className="mt-1 text-[8px] text-zinc-600">{commit.author || "Unknown"} · {formatDate(commit.timestamp)}</p><code className="mt-1 block truncate text-[8px] text-zinc-700">{commit.metadata?.commitHash || commit.locator}</code></li>)}</ol> : <p className="mt-2 text-[9px] text-zinc-600">No file history returned.</p>)}{fileHistory?.length > 30 && <p className="mt-2 text-[8px] text-zinc-700">Showing the 30 most recent changes.</p>}</div>}</>}</aside></div>}

      {!loading && modules.length > 0 && <p className="mt-5 rounded-lg border border-sky-300/[0.07] bg-sky-300/[0.02] p-3 text-[9px] leading-4 text-zinc-600">These summaries reflect only the records and access your account can see. A low recorded contributor count may indicate a knowledge concentration risk; it does not establish that others lack familiarity.</p>}
    </div>
  );
}

function ModuleCard({ item, risk, selected, onSelect }) {
  const total = item.contributors?.reduce((sum, person) => sum + person.commitCount, 0) || 0;
  const signals = [...new Set([...(item.riskSignals || []), ...(risk?.riskSignals || [])])];
  return <button type="button" onClick={onSelect} className={`w-full rounded-xl border bg-[#111114] p-4 text-left transition-colors sm:p-5 ${selected ? "border-violet-300/20" : "border-white/[0.065] hover:border-white/[0.12]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[13px] font-semibold text-zinc-200">{item.module}</h2><p className="mt-1 text-[9px] text-zinc-600">{item.totalCommits} recorded commit touches · {item.contributors?.length || 0} contributor(s)</p></div><span className="rounded-md border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[9px] text-zinc-500">{item.contributors?.length === 1 ? "Concentrated signal" : "Activity map"}</span></div><div className="mt-4 space-y-3">{(item.contributors || []).map((person) => <div key={person.name}><div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-[9px] text-zinc-400">{person.name}</span><span className="shrink-0 text-[9px] tabular-nums text-zinc-600">{person.commitCount} commits</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.045]"><div className="h-full rounded-full bg-violet-300/65" style={{ width: `${total ? Math.max(2, person.commitCount / total * 100) : 0}%` }} /></div><p className="mt-1 text-[8px] text-zinc-700">{person.filesModified} files · {formatDate(person.lastActivity)}</p></div>)}</div>{signals.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{signals.map((signal) => <span key={signal} title={signal} className="rounded border border-amber-300/[0.12] bg-amber-300/[0.03] px-2 py-1 text-[8px] text-amber-100/70">{riskLabels[signal] || signal.replaceAll("_", " ")}</span>)}</div>}</button>;
}
