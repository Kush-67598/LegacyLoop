"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, BookOpenCheck, Check, CircleAlert, Clock3, FileSearch, GitBranch, LoaderCircle, Pencil, ShieldCheck, UploadCloud } from "lucide-react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { getCase, listCaseClaims, listCaseEvidence, updateCase } from "@/services/caseService";
import { analyzeCase } from "@/services/analysisService";

const workflow = ["Case created", "Evidence collected", "Claims extracted", "Claims verified", "Human review", "Handover ready"];

function dateLabel(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function summaryValue(value) {
  return value === null ? "—" : value;
}

export default function CaseWorkspace({ caseId }) {
  const router = useRouter();
  const [caseData, setCaseData] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [claims, setClaims] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const loadCase = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [record, evidenceResult, claimsResult] = await Promise.all([
        getCase(caseId, { signal }),
        listCaseEvidence(caseId, { signal }).catch(() => null),
        listCaseClaims(caseId, { signal }).catch(() => null)
      ]);
      setCaseData(record);
      setEvidence(Array.isArray(evidenceResult) ? evidenceResult : evidenceResult?.evidence || null);
      setClaims(Array.isArray(claimsResult) ? claimsResult : claimsResult?.claims || null);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Unable to load this case.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => loadCase(controller.signal));
    return () => controller.abort();
  }, [loadCase]);

  const counts = useMemo(() => {
    const verified = claims?.filter((claim) => claim.status === "verified").length ?? null;
    const pendingReviews = claims?.filter((claim) => claim.reviewStatus === "pending" || claim.reviewStatus === "needs_more_evidence").length ?? null;
    const conflicts = claims?.filter((claim) => claim.status === "conflicting").length ?? null;
    const gaps = claims?.filter((claim) => ["unsupported", "missing_evidence"].includes(claim.status)).length ?? null;
    return { evidence: evidence?.length ?? null, claims: claims?.length ?? null, verified, pendingReviews, conflicts, gaps };
  }, [claims, evidence]);

  const stages = useMemo(() => {
    const hasEvidence = Boolean(evidence?.length);
    const hasClaims = Boolean(claims?.length);
    const checkedClaims = Boolean(claims?.some((claim) => claim.status && !["pending", "needs_ai_review"].includes(claim.status)));
    const reviewedClaims = Boolean(claims?.length && claims.every((claim) => claim.reviewStatus === "approved"));
    const handoverReady = ["ready_for_handover", "completed"].includes(caseData?.status);
    return [true, hasEvidence, hasClaims, checkedClaims, reviewedClaims, handoverReady];
  }, [caseData?.status, claims, evidence]);

  async function saveChanges(values) {
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updateCase(caseId, values);
      setCaseData(updated);
      setEditing(false);
    } catch (requestError) {
      setSaveError(requestError.message || "Could not update this case.");
    } finally {
      setSaving(false);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true); setAnalysisError("");
    try { setAnalysis(await analyzeCase(caseId)); }
    catch (requestError) { setAnalysisError(requestError.message || "Project analysis failed."); }
    finally { setAnalyzing(false); }
  }

  if (loading) return <div role="status" aria-label="Loading case workspace" className="mx-auto w-full max-w-[1280px] px-5 pt-8 sm:px-8"><div className="h-6 w-32 animate-pulse rounded bg-white/[0.05]" /><div className="mt-5 h-10 w-2/3 animate-pulse rounded bg-white/[0.05]" /><div className="mt-8 grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />)}</div></div>;
  if (error) return <div className="mx-auto flex max-w-xl flex-col items-center px-6 pt-24 text-center"><CircleAlert size={24} className="text-rose-200" /><h1 className="mt-4 text-[16px] font-semibold text-zinc-200">Case unavailable</h1><p className="mt-2 text-[11px] leading-5 text-zinc-500">{error}</p><button type="button" onClick={() => loadCase()} className="mt-5 rounded-lg border border-white/[0.09] px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/[0.05]">Try again</button><button type="button" onClick={() => router.push("/cases")} className="mt-3 text-[10px] text-zinc-600 hover:text-zinc-300">Back to all cases</button></div>;
  if (!caseData) return null;

  const summary = [
    { label: "Evidence records", value: summaryValue(counts.evidence), icon: FileSearch, note: evidence === null ? "Evidence service unavailable" : "Accessible evidence in this case" },
    { label: "Claims", value: summaryValue(counts.claims), icon: Activity, note: claims === null ? "Claims service unavailable" : "Claims linked to evidence" },
    { label: "Verified", value: summaryValue(counts.verified), icon: ShieldCheck, note: "Verification status, separate from review" },
    { label: "Pending reviews", value: summaryValue(counts.pendingReviews), icon: Clock3, note: "Human review status" },
    { label: "Conflicts", value: summaryValue(counts.conflicts), icon: CircleAlert, note: "Claims flagged as conflicting" },
    { label: "Knowledge gaps", value: summaryValue(counts.gaps), icon: BookOpenCheck, note: "Unsupported or missing evidence" }
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0"><Link href="/cases" className="text-[10px] text-zinc-600 hover:text-zinc-300">All cases</Link><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-[25px] font-semibold tracking-[-0.045em] text-zinc-100 sm:text-[29px]">{caseData.projectName}</h1><StatusBadge status={caseData.status} /></div><p className="mt-1.5 text-[12px] text-zinc-500">{caseData.title}</p>{caseData.description && <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[11px] leading-5 text-zinc-500">{caseData.description}</p>}</div>
        <button type="button" onClick={() => { setSaveError(""); setEditing((value) => !value); }} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.04]"><Pencil size={13} /> {editing ? "Close editor" : "Edit case"}</button>
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-3 rounded-xl border border-white/[0.06] bg-[#111114] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Departing member" value={caseData.departingMember} /><Detail label="Successor" value={caseData.successor} /><Detail label="Created" value={dateLabel(caseData.createdAt)} /><Detail label="Last updated" value={dateLabel(caseData.updatedAt)} /></div>

      {editing && <EditCaseForm caseData={caseData} saving={saving} error={saveError} onSave={saveChanges} onCancel={() => setEditing(false)} />}

      <section className="mt-6 rounded-xl border border-white/[0.065] bg-[#111114] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h2 className="text-[13px] font-semibold text-zinc-200">Handover progress</h2><p className="mt-1 text-[10px] text-zinc-600">Stages reflect records and statuses returned by the API.</p></div><span className="text-[10px] text-zinc-600">Updated {dateLabel(caseData.updatedAt)}</span></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{workflow.map((label, index) => <div key={label} className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${stages[index] ? "border-emerald-300/[0.12] bg-emerald-300/[0.025]" : "border-white/[0.05] bg-white/[0.012]"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${stages[index] ? "bg-emerald-300/[0.08] text-emerald-200" : "bg-white/[0.035] text-zinc-600"}`}>{stages[index] ? <Check size={14} /> : <span className="text-[10px] tabular-nums">0{index + 1}</span>}</span><span className={`text-[11px] font-medium ${stages[index] ? "text-zinc-300" : "text-zinc-600"}`}>{label}</span></div>)}</div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">{summary.map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-xl border border-white/[0.065] bg-[#111114] p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-medium text-zinc-500">{item.label}</span><Icon size={15} className="text-zinc-600" /></div><div className="mt-3 text-[24px] font-semibold leading-none tracking-[-0.05em] text-zinc-100">{item.value}</div><p className="mt-3 text-[9px] text-zinc-700">{item.note}</p></article>; })}</div>

      <section className="mt-6"><div className="mb-3"><h2 className="text-[13px] font-semibold text-zinc-200">Next actions</h2><p className="mt-1 text-[10px] text-zinc-600">Continue building an evidence-backed handover.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><ActionCard href={`/cases/${caseId}/evidence`} icon={UploadCloud} title="Upload project evidence" detail="Add repository and project records" /><ActionCard href={`/cases/${caseId}/ownership`} icon={GitBranch} title="Review ownership signals" detail="Explore contributor activity by module" /><ActionCard href={`/cases/${caseId}/claims`} icon={BookOpenCheck} title="Review claims" detail="Inspect or add cited claims" /></div></section>

      <section className="mt-5 rounded-xl border border-white/[0.065] bg-[#111114] p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-[13px] font-semibold text-zinc-200">Analyze project evidence</h2><p className="mt-1 max-w-2xl text-[10px] leading-5 text-zinc-600">Run the backend’s deterministic analysis for ownership signals, open work, contributors and an evidence timeline.</p></div><button type="button" onClick={runAnalysis} disabled={analyzing} className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-300/15 bg-violet-300/[0.06] px-3 text-[9px] font-medium text-violet-100 hover:bg-violet-300/[0.1] disabled:opacity-50">{analyzing ? <><LoaderCircle size={12} className="animate-spin" /> Analyzing…</> : "Run analysis"}</button></div><p className="mt-3 text-[9px] text-zinc-700">This endpoint does not use an AI provider or extract claims. Claims must be created and cited separately.</p>{analysisError && <p role="alert" className="mt-3 text-[9px] text-rose-200">{analysisError}</p>}{analysis && <AnalysisResult report={analysis} />}</section>
    </div>
  );
}

function Detail({ label, value }) {
  return <div><div className="text-[9px] font-medium uppercase tracking-[0.1em] text-zinc-700">{label}</div><div className="mt-1 text-[11px] text-zinc-300">{value || "—"}</div></div>;
}

function ActionCard({ href, icon: Icon, title, detail }) {
  return <Link href={href} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#111114] p-4 transition-colors hover:border-white/[0.12] hover:bg-white/[0.015]"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-500"><Icon size={15} /></div><div className="min-w-0 flex-1"><h3 className="text-[11px] font-medium text-zinc-300">{title}</h3><p className="mt-1 text-[9px] leading-4 text-zinc-600">{detail}</p></div><ArrowRight size={13} className="mt-1 shrink-0 text-zinc-700" /></Link>;
}

function AnalysisResult({ report }) {
  const work = report.openWork || {};
  const openTasks = work.openTasks || [];
  const openPrs = work.unmergedPullRequests || [];
  const timeline = report.timeline || [];
  return <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-white/[0.05] p-3"><h3 className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Open work</h3><p className="mt-1 text-[8px] text-zinc-700">{openTasks.length} open task(s) · {openPrs.length} unmerged PR(s)</p>{[...openTasks, ...openPrs].slice(0, 6).map((item) => <div key={item.evidenceId} className="mt-2 border-t border-white/[0.04] pt-2"><p className="text-[9px] leading-4 text-zinc-300">{item.title}</p><p className="mt-1 text-[8px] text-zinc-600">{item.state} · {item.assignee || "Unassigned"}{item.stale ? " · Stale PR" : ""}</p></div>)}{!openTasks.length && !openPrs.length && <p className="mt-2 text-[8px] text-zinc-700">No open work was identified in accessible task/PR evidence.</p>}</div><div className="rounded-lg border border-white/[0.05] p-3"><h3 className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Contributor signals</h3>{(report.contributors || []).slice(0, 8).map((item) => <div key={item.module} className="mt-2 border-t border-white/[0.04] pt-2"><p className="text-[9px] text-zinc-300">{item.module}</p><p className="mt-1 text-[8px] text-zinc-600">{item.recordedContributors} recorded contributors · {item.departingMemberCommitShare === null ? "leaver share unavailable" : `${Math.round(item.departingMemberCommitShare * 100)}% leaver activity`}</p></div>)}{!report.contributors?.length && <p className="mt-2 text-[8px] text-zinc-700">No contributor activity was found.</p>}</div><div className="rounded-lg border border-white/[0.05] p-3 lg:col-span-2"><h3 className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Evidence timeline</h3>{timeline.slice(-8).reverse().map((item) => <div key={item.evidenceId} className="mt-2 grid gap-1 border-t border-white/[0.04] pt-2 sm:grid-cols-[140px_1fr]"><span className="text-[8px] text-zinc-600">{item.date ? new Date(item.date).toLocaleDateString() : "Date unavailable"} · {item.author || "Unknown"}</span><p className="text-[9px] leading-4 text-zinc-400">{item.event}</p></div>)}{!timeline.length && <p className="mt-2 text-[8px] text-zinc-700">No timestamped evidence was available for the timeline.</p>}</div></div>;
}

function EditCaseForm({ caseData, saving, error, onSave, onCancel }) {
  const [values, setValues] = useState({ title: caseData.title || "", description: caseData.description || "", projectName: caseData.projectName || "", departingMember: caseData.departingMember || "", successor: caseData.successor || "" });
  const [validation, setValidation] = useState("");
  const fields = [["projectName", "Project name"], ["title", "Case title"], ["departingMember", "Departing member"], ["successor", "Successor"]];

  function submit(event) {
    event.preventDefault();
    const clean = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
    if (Object.entries(clean).some(([key, value]) => key !== "description" && !value)) return setValidation("Project, title, departing member and successor are required.");
    if (Object.entries(clean).some(([key, value]) => value.length > (key === "description" ? 5000 : 200))) return setValidation("One or more fields exceed the supported length.");
    setValidation("");
    onSave(clean);
  }

  return <form onSubmit={submit} className="mt-4 rounded-xl border border-violet-300/[0.12] bg-[#111114] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[13px] font-semibold text-zinc-200">Edit case details</h2><p className="mt-1 text-[10px] text-zinc-600">Changes are saved to the case record.</p></div><button type="button" onClick={onCancel} className="text-[10px] text-zinc-500 hover:text-zinc-200">Cancel</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="text-[10px] font-medium text-zinc-400">{label}<input required maxLength={200} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.09] bg-[#0c0c0f] px-3 text-[11px] text-zinc-200 outline-none focus:border-violet-300/35" /></label>)}<label className="text-[10px] font-medium text-zinc-400 sm:col-span-2">Description<textarea maxLength={5000} rows={3} value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-[#0c0c0f] px-3 py-2 text-[11px] text-zinc-200 outline-none focus:border-violet-300/35" /></label></div>{(validation || error) && <p role="alert" className="mt-3 text-[10px] text-rose-200">{validation || error}</p>}<div className="mt-4 flex justify-end"><button disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-300 px-3.5 text-[11px] font-semibold text-[#100d1d] hover:bg-violet-200 disabled:opacity-60">{saving ? "Saving…" : "Save changes"}<ArrowRight size={13} /></button></div></form>;
}
