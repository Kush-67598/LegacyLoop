"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ChevronDown, FilePlus2, FileSearch, Search, ShieldCheck, X } from "lucide-react";
import { createClaim, getClaimConflicts, listClaims } from "@/services/claimService";
import { listEvidence } from "@/services/evidenceService";
import { listReviews } from "@/services/reviewService";

const claimTypes = ["ownership", "technical_decision", "unfinished_work", "dependency", "risk", "commitment", "configuration", "general"];
const verificationStatuses = ["all", "verified", "inferred", "conflicting", "unsupported", "missing_evidence", "leaver_stated", "needs_ai_review", "pending"];
const reviewStatuses = ["all", "pending", "approved", "rejected", "needs_more_evidence"];
const statusLabels = { needs_ai_review: "Needs AI review", missing_evidence: "Missing evidence", needs_more_evidence: "Needs more evidence", leaver_stated: "Leaver stated" };
const statusStyles = { verified: "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200", approved: "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200", inferred: "border-amber-300/15 bg-amber-300/[0.05] text-amber-200", pending: "border-amber-300/15 bg-amber-300/[0.05] text-amber-200", conflicting: "border-rose-300/15 bg-rose-300/[0.05] text-rose-200", unsupported: "border-rose-300/15 bg-rose-300/[0.05] text-rose-200", rejected: "border-rose-300/15 bg-rose-300/[0.05] text-rose-200", missing_evidence: "border-zinc-500/20 bg-zinc-400/[0.04] text-zinc-400", needs_ai_review: "border-sky-300/15 bg-sky-300/[0.04] text-sky-200", leaver_stated: "border-violet-300/15 bg-violet-300/[0.04] text-violet-200", needs_more_evidence: "border-amber-300/15 bg-amber-300/[0.05] text-amber-200" };

const label = (value) => statusLabels[value] || String(value || "pending").replaceAll("_", " ");

function Badge({ value, kind }) { return <span className={`inline-flex rounded border px-2 py-1 text-[8px] font-medium capitalize ${statusStyles[value] || "border-white/[0.07] bg-white/[0.02] text-zinc-500"}`}><span className="mr-1 opacity-60">{kind}</span>{label(value)}</span>; }

export default function ClaimsWorkspace({ caseId }) {
  const searchParams = useSearchParams();
  const [claims, setClaims] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [claimData, evidenceData, reviewData] = await Promise.all([listClaims(caseId, { signal }), listEvidence(caseId, { signal }), listReviews(caseId, { signal }).catch(() => [])]);
      setClaims(Array.isArray(claimData) ? claimData : []);
      setEvidence(Array.isArray(evidenceData) ? evidenceData : []);
      setReviews(Array.isArray(reviewData) ? reviewData : []);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Claims could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [caseId]);

  useEffect(() => { const controller = new AbortController(); Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);
  useEffect(() => {
    const id = searchParams.get("claim");
    if (!id) return;
    const item = claims.find((claim) => claim._id === id);
    Promise.resolve().then(() => { if (item) setSelected(item); });
  }, [claims, searchParams]);

  const filtered = useMemo(() => claims.filter((claim) => {
    if (verificationFilter !== "all" && claim.status !== verificationFilter) return false;
    if (reviewFilter !== "all" && claim.reviewStatus !== reviewFilter) return false;
    return !query.trim() || claim.text.toLowerCase().includes(query.trim().toLowerCase());
  }), [claims, query, reviewFilter, verificationFilter]);

  async function selectClaim(claim) {
    setSelected(claim);
    try { setConflicts(await getClaimConflicts(claim._id)); } catch { setConflicts([]); }
  }

  function saveCreated(claim) {
    setClaims((current) => [claim, ...current]);
    setSelected(claim);
    setCreating(false);
  }

  const evidenceMap = useMemo(() => new Map(evidence.map((item) => [String(item._id), item])), [evidence]);
  const selectedReviews = reviews.filter((review) => String(review.claimId) === String(selected?._id));

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href={`/cases/${caseId}`} className="text-[10px] text-zinc-600 hover:text-zinc-300">Case overview</Link><h1 className="mt-3 text-[25px] font-semibold tracking-[-0.045em] text-zinc-100">Claims</h1><p className="mt-1.5 text-[11px] text-zinc-500">Review each proposed statement alongside its verification state and source citations.</p></div><button type="button" onClick={() => { setCreating((value) => !value); setCreateError(""); }} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-violet-300/15 bg-violet-300/[0.08] px-3 text-[10px] font-medium text-violet-100 hover:bg-violet-300/[0.13]"><FilePlus2 size={13} /> Add claim</button></div>

      {creating && <CreateClaimForm caseId={caseId} evidence={evidence} error={createError} onError={setCreateError} onCancel={() => setCreating(false)} onCreated={saveCreated} />}
      {error && <div role="alert" className="mt-5 flex items-center gap-2 rounded-lg border border-rose-300/10 bg-rose-300/[0.04] p-3 text-[10px] text-rose-200"><AlertCircle size={13} />{error}<button type="button" onClick={() => load()} className="ml-auto underline">Retry</button></div>}

      <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_440px]"><section className="min-w-0 overflow-hidden rounded-xl border border-white/[0.065] bg-[#111114]"><div className="space-y-3 border-b border-white/[0.055] p-4"><label className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-zinc-600"><Search size={13} /><input aria-label="Search claim statements" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search claims" className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-200 outline-none placeholder:text-zinc-700" /></label><div className="grid grid-cols-2 gap-2"><Select label="Verification" value={verificationFilter} onChange={setVerificationFilter} options={verificationStatuses} /><Select label="Review" value={reviewFilter} onChange={setReviewFilter} options={reviewStatuses} /></div></div>
        {loading ? <div role="status" aria-label="Loading claims" className="space-y-2 p-4">{[0, 1, 2].map((index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-white/[0.03]" />)}</div> : filtered.length === 0 ? <div className="px-6 py-16 text-center"><FileSearch size={20} className="mx-auto text-zinc-700" /><h2 className="mt-3 text-[11px] font-medium text-zinc-300">{claims.length ? "No claims match those filters" : "No claims yet"}</h2><p className="mt-1 text-[9px] leading-4 text-zinc-600">{claims.length ? "Adjust the status filters or search text." : "Analysis does not extract claims in the current backend. Add a claim with source citations for review."}</p>{!claims.length && <button type="button" onClick={() => setCreating(true)} className="mt-3 text-[9px] text-violet-200">Add a cited claim</button>}</div> : <div className="divide-y divide-white/[0.04]">{filtered.map((claim) => <button type="button" key={claim._id} onClick={() => selectClaim(claim)} className={`block w-full px-4 py-4 text-left transition-colors hover:bg-white/[0.025] ${selected?._id === claim._id ? "bg-violet-300/[0.035]" : ""}`}><div className="flex flex-wrap items-center gap-1.5"><span className="rounded border border-white/[0.06] px-1.5 py-1 text-[8px] capitalize text-zinc-500">{claim.claimType.replaceAll("_", " ")}</span><Badge value={claim.status} kind="Verify" /><Badge value={claim.reviewStatus} kind="Review" /></div><p className="mt-2 text-[10px] leading-5 text-zinc-300">{claim.text}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-zinc-600"><span>{claim.evidenceIds?.length || 0} evidence source(s)</span><span>Access: {claim.accessLevel?.replaceAll("_", " ") || "team"}</span><span>Version {claim.version}</span></div></button>)}</div>}</section>

        <ClaimDetail claim={selected} evidenceMap={evidenceMap} reviews={selectedReviews} conflicts={conflicts} />
      </div>
    </div>
  );
}

function Select({ label: fieldLabel, value, onChange, options }) { return <label className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-white/[0.06] px-2 text-[8px] text-zinc-600"><span className="shrink-0">{fieldLabel}</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label={`${fieldLabel} filter`} className="min-w-0 flex-1 bg-transparent capitalize text-zinc-400 outline-none">{options.map((option) => <option key={option} value={option} className="bg-[#111114]">{option === "all" ? "All" : label(option)}</option>)}</select><ChevronDown size={11} /></label>; }

function CreateClaimForm({ caseId, evidence, error, onError, onCreated, onCancel }) {
  const [text, setText] = useState("");
  const [claimType, setClaimType] = useState("technical_decision");
  const [accessLevel, setAccessLevel] = useState("team");
  const [selectedIds, setSelectedIds] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!text.trim()) return setValidation("Enter the claim statement.");
    if (!selectedIds.length) return setValidation("Select at least one evidence record.");
    if (selectedIds.some((id) => !quotes[id]?.trim())) return setValidation("Add an exact quote for each selected evidence record.");
    setSaving(true); setValidation(""); onError("");
    try {
      const result = await createClaim(caseId, { text: text.trim(), claimType, accessLevel, evidenceIds: selectedIds, citations: selectedIds.map((evidenceId) => ({ evidenceId, quote: quotes[evidenceId].trim() })) });
      onCreated(result);
    } catch (requestError) { onError(requestError.message || "Claim could not be created."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="mt-5 rounded-xl border border-violet-300/[0.12] bg-[#111114] p-5"><div className="flex items-start justify-between"><div><h2 className="text-[12px] font-semibold text-zinc-200">Add an evidence-linked claim</h2><p className="mt-1 text-[9px] text-zinc-600">The backend checks citation text and case association, then assigns a verification state.</p></div><button type="button" onClick={onCancel} aria-label="Close claim form" className="text-zinc-600 hover:text-zinc-200"><X size={15} /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[9px] text-zinc-500 sm:col-span-2">Claim statement<textarea maxLength={5000} rows={3} value={text} onChange={(event) => setText(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-black/10 px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-violet-300/30" placeholder="State one clear, evidence-supported fact." /></label><label className="text-[9px] text-zinc-500">Claim type<select value={claimType} onChange={(event) => setClaimType(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.08] bg-[#0c0c0f] px-2 text-[10px] capitalize text-zinc-300">{claimTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label><label className="text-[9px] text-zinc-500">Requested access level<select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.08] bg-[#0c0c0f] px-2 text-[10px] text-zinc-300"><option value="team">Team</option><option value="leads_only">Leads only</option><option value="restricted">Restricted</option></select><span className="mt-1 block text-[8px] text-zinc-700">Supporting evidence can increase this restriction.</span></label></div><div className="mt-4"><p className="mb-2 text-[9px] font-medium text-zinc-400">Supporting evidence and exact quotations</p>{evidence.length === 0 ? <p className="rounded-md border border-amber-300/[0.08] p-3 text-[9px] text-amber-100/65">Upload evidence before creating a claim.</p> : <div className="max-h-[280px] space-y-2 overflow-y-auto">{evidence.map((record) => { const checked = selectedIds.includes(record._id); return <div key={record._id} className="rounded-lg border border-white/[0.06] bg-black/10 p-3"><label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={checked} onChange={(event) => { setSelectedIds((current) => event.target.checked ? [...current, record._id] : current.filter((id) => id !== record._id)); }} className="mt-0.5 accent-violet-300" /><span className="min-w-0 flex-1"><span className="block truncate text-[9px] text-zinc-300">{record.sourceName} · {record.locator}</span><span className="mt-1 line-clamp-2 block text-[8px] leading-4 text-zinc-600">{record.text}</span></span></label>{checked && <textarea value={quotes[record._id] || ""} onChange={(event) => setQuotes((current) => ({ ...current, [record._id]: event.target.value }))} rows={2} className="mt-2 w-full rounded-md border border-white/[0.07] bg-[#0b0b0e] px-2.5 py-2 text-[9px] text-zinc-300 outline-none focus:border-violet-300/25" placeholder="Paste an exact quotation from this evidence" />}</div>; })}</div>}</div>{(validation || error) && <p role="alert" className="mt-3 text-[9px] text-rose-200">{validation || error}</p>}<div className="mt-4 flex justify-end"><button type="submit" disabled={saving || evidence.length === 0} className="h-8 rounded-lg bg-violet-300 px-3 text-[9px] font-semibold text-[#100d1d] hover:bg-violet-200 disabled:opacity-50">{saving ? "Checking citations…" : "Create claim"}</button></div></form>;
}

function ClaimDetail({ claim, evidenceMap, reviews, conflicts }) {
  if (!claim) return <aside className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-white/[0.065] bg-[#111114] px-6 text-center"><ShieldCheck size={22} className="text-zinc-700" /><p className="mt-3 text-[10px] text-zinc-600">Select a claim to inspect its checks, evidence and review history.</p></aside>;
  const failures = claim.verification?.citationCheck?.failures || [];
  return <aside className="max-h-[850px] overflow-y-auto rounded-xl border border-white/[0.065] bg-[#111114] p-5"><div className="flex items-start justify-between gap-3"><span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-violet-200/65">Claim detail</span><span className="text-[8px] text-zinc-700">v{claim.version}</span></div><p className="mt-2 text-[11px] leading-5 text-zinc-200">{claim.text}</p><div className="mt-3 flex flex-wrap gap-1.5"><Badge value={claim.status} kind="Verify" /><Badge value={claim.reviewStatus} kind="Review" /></div><div className="mt-4 rounded-lg border border-white/[0.05] bg-black/10 p-3"><h3 className="text-[8px] font-semibold uppercase tracking-wider text-zinc-600">Citation validation</h3><p className="mt-1 text-[9px] text-zinc-400">{claim.verification?.citationCheck?.valid ? "Exact quotations matched cited evidence." : failures.length ? `${failures.length} citation issue(s) recorded.` : "No successful citation check is recorded."}</p>{failures.map((failure, index) => <p key={`${failure.code}-${index}`} className="mt-1 text-[8px] text-rose-200/75">{failure.message}</p>)}<p className="mt-3 text-[8px] leading-4 text-zinc-600">Support assessment: {claim.verification?.supportCheck?.reason || "No AI support assessment is configured."}</p></div>
    <div className="mt-4"><h3 className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-zinc-600">Supporting evidence ({claim.evidenceIds?.length || 0})</h3><div className="space-y-2">{(claim.citations || []).map((citation, index) => { const record = evidenceMap.get(String(citation.evidenceId)); return <div key={`${citation.evidenceId}-${index}`} className="rounded-lg border border-white/[0.05] p-3"><p className="text-[9px] leading-4 text-emerald-100/75">“{citation.quote}”</p>{record ? <><Link href={`/cases/${claim.caseId}/evidence?evidence=${record._id}`} className="mt-2 block truncate text-[8px] text-violet-200/70 hover:text-violet-100">{record.sourceName} · {record.locator}</Link><p className="mt-1 line-clamp-2 text-[8px] leading-4 text-zinc-600">{record.text}</p><p className="mt-1 text-[8px] text-zinc-700">{record.author || "Unknown author"} · access {record.accessLevel}</p></> : <p className="mt-2 text-[8px] text-zinc-600">Evidence detail is not available in the current result.</p>}</div>; })}{(!claim.citations || claim.citations.length === 0) && <p className="rounded-lg border border-zinc-500/10 p-3 text-[9px] text-zinc-600">No exact quotations are attached.</p>}</div></div>
    {conflicts.length > 0 && <div className="mt-4"><h3 className="text-[8px] font-semibold uppercase tracking-wider text-rose-200/70">Potential conflicts</h3>{conflicts.map((conflict) => <div key={conflict._id} className="mt-2 rounded-lg border border-rose-300/10 bg-rose-300/[0.025] p-3"><p className="text-[9px] leading-4 text-zinc-400">{conflict.reason}</p><p className="mt-1 text-[8px] text-zinc-600">Entity: {conflict.entityKey}</p></div>)}</div>}
    <div className="mt-4"><h3 className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-zinc-600">Review history ({reviews.length})</h3>{reviews.length ? <ol className="space-y-2">{reviews.map((review) => <li key={`${review._id}-${review.version}`} className="rounded-lg border border-white/[0.05] p-3"><div className="flex justify-between text-[8px] text-zinc-500"><span className="capitalize">{review.action.replaceAll("_", " ")}</span><span>v{review.version}</span></div>{review.comment && <p className="mt-1 text-[8px] leading-4 text-zinc-600">{review.comment}</p>}{review.previousText && <details className="mt-1"><summary className="cursor-pointer text-[8px] text-zinc-700">Version text</summary><p className="mt-1 text-[8px] text-zinc-600">{review.previousText}{review.updatedText ? ` → ${review.updatedText}` : ""}</p></details>}</li>)}</ol> : <p className="text-[9px] text-zinc-700">No review actions recorded.</p>}</div>
    <div className="mt-4 flex gap-4 border-t border-white/[0.05] pt-3 text-[8px] text-zinc-700"><span>Access: {claim.accessLevel}</span><span>Version {claim.version}</span>{claim.previousVersion && <span>Previous version: {String(claim.previousVersion).slice(0, 8)}…</span>}</div></aside>;
}
