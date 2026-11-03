"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, BookOpenCheck, Check, CircleAlert, Clock3, FileSearch, GitBranch, LoaderCircle, Pencil, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { getCase, getCaseProgress, listCaseClaims, listCaseEvidence, updateCase } from "@/services/caseService";
import { analyzeCase } from "@/services/analysisService";
import { generateClaims } from "@/services/claimService";

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
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [generatingClaims, setGeneratingClaims] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationResult, setGenerationResult] = useState(null);
  const generationLock = useRef(false);

  const loadCase = useCallback(async (signal, { quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const [record, evidenceResult, claimsResult, progressResult] = await Promise.all([
        getCase(caseId, { signal }),
        listCaseEvidence(caseId, { signal }).catch(() => null),
        listCaseClaims(caseId, { signal }).catch(() => null),
        getCaseProgress(caseId, { signal }).catch(() => null)
      ]);
      setCaseData(record);
      setEvidence(Array.isArray(evidenceResult) ? evidenceResult : evidenceResult?.evidence || null);
      setClaims(Array.isArray(claimsResult) ? claimsResult : claimsResult?.claims || null);
      setProgress(progressResult);
    } catch (requestError) {
      if (requestError.name !== "AbortError" && !quiet) setError(requestError.message || "Unable to load this case.");
    } finally {
      if (!signal?.aborted && !quiet) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => loadCase(controller.signal));
    return () => controller.abort();
  }, [loadCase]);

  useEffect(() => {
    function refreshProgress(event) {
      if (!event.detail?.caseId || String(event.detail.caseId) === String(caseId)) loadCase(undefined, { quiet: true });
    }
    window.addEventListener("legacyloop:case-progress-changed", refreshProgress);
    return () => window.removeEventListener("legacyloop:case-progress-changed", refreshProgress);
  }, [caseId, loadCase]);

  const counts = useMemo(() => {
    const verified = progress?.counts?.verified ?? claims?.filter((claim) => claim.status === "verified").length ?? null;
    const humanApprovedUnverified = progress?.counts?.humanApprovedUnverified ?? claims?.filter((claim) => claim.reviewStatus === "approved" && claim.status !== "verified").length ?? null;
    const pendingReviews = progress?.counts?.pendingReviews ?? claims?.filter((claim) => claim.reviewStatus === "pending" || claim.reviewStatus === "needs_more_evidence").length ?? null;
    const conflicts = claims?.filter((claim) => claim.status === "conflicting").length ?? null;
    const gaps = claims?.filter((claim) => ["unsupported", "missing_evidence"].includes(claim.status)).length ?? null;
    return {
      evidence: progress?.counts?.evidence ?? evidence?.length ?? null,
      claims: progress?.counts?.claims ?? claims?.length ?? null,
      verified, humanApprovedUnverified, pendingReviews, conflicts, gaps
    };
  }, [claims, evidence, progress]);

  const stages = useMemo(() => {
    const terminalReviews = new Set(["approved", "rejected"]);
    const hasEvidence = evidence?.length > 0;
    const hasClaims = claims?.length > 0;
    return [
      Boolean(caseData),
      progress?.stages?.evidenceCollected ?? Boolean(hasEvidence),
      progress?.stages?.claimsExtracted ?? Boolean(hasClaims),
      progress?.stages?.claimsVerified ?? Boolean(hasClaims && claims.every((claim) => claim.status === "verified")),
      progress?.stages?.humanReview ?? Boolean(hasClaims && claims.every((claim) => terminalReviews.has(claim.reviewStatus))),
      progress?.stages?.handoverReady ?? false
    ];
  }, [caseData, claims, evidence, progress]);

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

  async function runClaimGeneration() {
    if (!analysis || !evidence?.length || generationLock.current) return;
    const confirmed = window.confirm("Generate evidence-linked claims from the evidence accessible to you? The AI provider will receive that evidence and analysis. Claims remain pending and require human review.");
    if (!confirmed) return;
    generationLock.current = true;
    setGeneratingClaims(true);
    setGenerationError("");
    setGenerationResult(null);
    try {
      const result = await generateClaims(caseId);
      setGenerationResult(result);
      if (Array.isArray(result?.claims) && result.claims.length) {
        setClaims((current) => [...result.claims, ...(current || []).filter((claim) => !result.claims.some((created) => created._id === claim._id))]);
      }
      const currentProgress = await getCaseProgress(caseId).catch(() => null);
      if (currentProgress) setProgress(currentProgress);
    } catch (requestError) {
      setGenerationError(requestError.message || "Claims could not be generated.");
    } finally {
      generationLock.current = false;
      setGeneratingClaims(false);
    }
  }

  if (loading) return <div role="status" aria-label="Loading case workspace" className="mx-auto w-full max-w-[1280px] px-5 pt-8 sm:px-8"><div className="h-6 w-32 animate-pulse rounded bg-white/[0.05]" /><div className="mt-5 h-10 w-2/3 animate-pulse rounded bg-white/[0.05]" /><div className="mt-8 grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />)}</div></div>;
  if (error) return <div className="mx-auto flex max-w-xl flex-col items-center px-6 pt-24 text-center"><CircleAlert size={24} className="text-rose-200" /><h1 className="mt-4 text-[16px] font-semibold text-zinc-200">Case unavailable</h1><p className="mt-2 text-[11px] leading-5 text-zinc-500">{error}</p><button type="button" onClick={() => loadCase()} className="mt-5 rounded-lg border border-white/[0.09] px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/[0.05]">Try again</button><button type="button" onClick={() => router.push("/cases")} className="mt-3 text-[10px] text-zinc-600 hover:text-zinc-300">Back to all cases</button></div>;
  if (!caseData) return null;

  const summary = [
    { label: "Evidence records", value: summaryValue(counts.evidence), icon: FileSearch, note: evidence === null ? "Evidence service unavailable" : "Accessible evidence in this case" },
    { label: "Claims", value: summaryValue(counts.claims), icon: Activity, note: claims === null ? "Claims service unavailable" : "Claims linked to evidence" },
    { label: "AI verified", value: summaryValue(counts.verified), icon: ShieldCheck, note: "AI verification status only" },
    { label: "Approved, not AI-verified", value: summaryValue(counts.humanApprovedUnverified), icon: Check, note: "Human-approved claims with AI checks incomplete" },
    { label: "Pending reviews", value: summaryValue(counts.pendingReviews), icon: Clock3, note: "Human review status" },
    { label: "Conflicts", value: summaryValue(counts.conflicts), icon: CircleAlert, note: "Claims flagged as conflicting" },
    { label: "Knowledge gaps", value: summaryValue(counts.gaps), icon: BookOpenCheck, note: "Unsupported or missing evidence" }
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0"><Link href="/cases" className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-300">All cases</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-[30px] font-semibold leading-tight tracking-[-0.045em] text-zinc-100 sm:text-[36px]">{caseData.projectName}</h1><StatusBadge status={caseData.status} /></div><p className="mt-2 text-[15px] text-zinc-400">{caseData.title}</p>{caseData.description && <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[13px] leading-6 text-zinc-500">{caseData.description}</p>}</div>
        <button type="button" onClick={() => { setSaveError(""); setEditing((value) => !value); }} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-white/[0.10] bg-white/[0.025] px-3.5 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"><Pencil size={14} /> {editing ? "Close editor" : "Edit case"}</button>
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-5 rounded-lg border border-white/[0.075] bg-[#111114] px-5 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:grid-cols-2 sm:px-6 lg:grid-cols-4"><Detail label="Departing member" value={caseData.departingMember} /><Detail label="Successor" value={caseData.successor} /><Detail label="Created" value={dateLabel(caseData.createdAt)} /><Detail label="Last updated" value={dateLabel(caseData.updatedAt)} /></div>

      {editing && <EditCaseForm caseData={caseData} saving={saving} error={saveError} onSave={saveChanges} onCancel={() => setEditing(false)} />}

      <section className="mt-7 rounded-lg border border-white/[0.075] bg-[#111114] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:p-6 lg:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-violet-200/80">Workflow</p><h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.03em] text-zinc-100">Handover progress</h2><p className="mt-1.5 text-[13px] leading-5 text-zinc-500">AI verification and human approval are tracked independently.</p></div><span className="text-[11px] text-zinc-500">Updated {dateLabel(caseData.updatedAt)}</span></div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[12px]"><span className="font-medium text-zinc-300">{stages.filter(Boolean).length} of {workflow.length} stages complete</span><span className={`font-medium ${stages[5] ? "text-emerald-200" : "text-zinc-500"}`}>{stages[5] ? "Handover published" : "Handover not ready"}</span></div>
        <div role="progressbar" aria-label="Handover progress" aria-valuemin={0} aria-valuemax={workflow.length} aria-valuenow={stages.filter(Boolean).length} className="mt-3 grid grid-cols-6 gap-1.5">{stages.map((complete, index) => <span key={workflow[index]} className={`h-1.5 rounded-full ${complete ? (index === 5 ? "bg-emerald-300" : "bg-violet-300/80") : "bg-white/[0.08]"}`} />)}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{workflow.map((label, index) => {
          const unavailable = index === 3 && !stages[index] && Boolean(progress?.verification?.aiUnavailable);
          const handoverReady = index === 5;
          const stateLabel = stages[index]
            ? (handoverReady ? "Published" : index === 3 ? "AI verified" : "Complete")
            : unavailable ? "AI Verification Unavailable"
              : index === 4 && counts.pendingReviews > 0 ? `${counts.pendingReviews} pending`
                : index === 5 ? "Publish current report"
                  : index === 3 ? "Not yet verified" : "Not started";
          return <div key={label} className={`min-w-0 rounded-md border p-4 sm:p-4 ${stages[index] ? (handoverReady ? "border-emerald-300/20 bg-emerald-300/[0.045]" : "border-violet-300/[0.13] bg-violet-300/[0.025]") : unavailable ? "border-amber-300/15 bg-amber-300/[0.025]" : "border-white/[0.07] bg-white/[0.015]"}`}>
            <div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${stages[index] ? (handoverReady ? "bg-emerald-300/10 text-emerald-200" : "bg-violet-300/10 text-violet-200") : unavailable ? "bg-amber-300/10 text-amber-200" : "bg-white/[0.045] text-zinc-500"}`}>{stages[index] ? <Check size={17} /> : unavailable ? <CircleAlert size={17} /> : <span className="text-[12px] font-semibold tabular-nums">0{index + 1}</span>}</span><div className="min-w-0 flex-1"><h3 className="text-[14px] font-semibold leading-5 text-zinc-200">{label}</h3><p className={`mt-1.5 break-words text-[11px] font-medium leading-4 ${stages[index] ? (handoverReady ? "text-emerald-200" : "text-violet-200") : unavailable ? "text-amber-200" : "text-zinc-500"}`}>{stateLabel}</p></div></div>
          </div>;
        })}</div>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">{summary.map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-lg border border-white/[0.075] bg-[#111114] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.10)]"><div className="flex items-start justify-between gap-3"><span className="text-[12px] font-medium leading-5 text-zinc-400">{item.label}</span><Icon size={17} className="shrink-0 text-zinc-500" /></div><div className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.05em] text-zinc-100">{item.value}</div><p className="mt-3 text-[11px] leading-5 text-zinc-500">{item.note}</p></article>; })}</div>

      <section className="mt-8"><div className="mb-4"><h2 className="text-[19px] font-semibold tracking-[-0.025em] text-zinc-100">Next actions</h2><p className="mt-1.5 text-[13px] text-zinc-500">Continue building an evidence-backed handover.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><ActionCard href={`/cases/${caseId}/evidence`} icon={UploadCloud} title="Upload project evidence" detail="Add repository and project records" /><ActionCard href={`/cases/${caseId}/ownership`} icon={GitBranch} title="Review ownership signals" detail="Explore contributor activity by module" /><ActionCard href={`/cases/${caseId}/claims`} icon={BookOpenCheck} title="Review claims" detail="Inspect or add cited claims" /></div></section>

      <section className="mt-6 rounded-lg border border-white/[0.075] bg-[#111114] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="text-[18px] font-semibold tracking-[-0.025em] text-zinc-100">Analyze project evidence</h2><p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-zinc-500">Run deterministic analysis for ownership signals, open work, contributors and the evidence timeline.</p></div><button type="button" onClick={runAnalysis} disabled={analyzing} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-violet-300/20 bg-violet-300/[0.07] px-4 text-[12px] font-medium text-violet-100 hover:bg-violet-300/[0.12] disabled:opacity-50">{analyzing ? <><LoaderCircle size={14} className="animate-spin" /> Analyzing…</> : "Run analysis"}</button></div>{analysisError && <p role="alert" className="mt-3 text-[12px] text-rose-200">{analysisError}</p>}{analysis && <AnalysisResult report={analysis} />}
        <div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center"><div><h3 className="text-[14px] font-semibold text-zinc-200">Generate claims</h3><p className="mt-1 max-w-xl text-[12px] leading-5 text-zinc-500">Create evidence-cited knowledge statements. Generated claims require human review.</p></div><button type="button" onClick={runClaimGeneration} disabled={!analysis || !evidence?.length || generatingClaims} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-violet-300 px-4 text-[12px] font-semibold text-[#100d1d] hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-45">{generatingClaims ? <><LoaderCircle size={14} className="animate-spin" /> Generating claims…</> : <><Sparkles size={14} /> Generate Claims</>}</button></div>
        {!analysis && <p className="mt-3 text-[11px] text-zinc-600">Run deterministic analysis first to enable claim generation.</p>}
        {generationError && <p role="alert" className="mt-3 text-[12px] text-rose-200">{generationError}</p>}
        {generationResult && <div role="status" className="mt-4 flex flex-col justify-between gap-3 rounded-md border border-emerald-300/10 bg-emerald-300/[0.025] px-4 py-3 sm:flex-row sm:items-center"><p className="text-[12px] leading-5 text-emerald-100/80">Generated {generationResult.generatedCount} new claim(s); skipped {generationResult.skippedCount} invalid or duplicate result(s).</p><Link href={`/cases/${caseId}/claims`} className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-200 hover:text-violet-100">Open Claims <ArrowRight size={13} /></Link></div>}
      </section>
    </div>
  );
}

function Detail({ label, value }) {
  return <div className="min-w-0"><div className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">{label}</div><div className="mt-1.5 break-words text-[13px] font-medium text-zinc-200">{value || "—"}</div></div>;
}

function ActionCard({ href, icon: Icon, title, detail }) {
  return <Link href={href} className="flex min-w-0 items-start gap-3 rounded-lg border border-white/[0.075] bg-[#111114] p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.02] sm:p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.045] text-zinc-300"><Icon size={17} /></div><div className="min-w-0 flex-1"><h3 className="text-[13px] font-semibold text-zinc-200">{title}</h3><p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{detail}</p></div><ArrowRight size={14} className="mt-1 shrink-0 text-zinc-600" /></Link>;
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
