"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, CheckCheck, FileSearch, MessageSquareMore, Pencil, RotateCcw, ShieldCheck, X } from "lucide-react";
import { listClaims } from "@/services/claimService";
import { listEvidence } from "@/services/evidenceService";
import { listReviews, reviewClaim } from "@/services/reviewService";

const statusLabels = { needs_ai_review: "Needs AI review", missing_evidence: "Missing evidence", needs_more_evidence: "Needs more evidence", leaver_stated: "Leaver stated" };
const verificationTone = { verified: "text-emerald-200 border-emerald-300/15 bg-emerald-300/[0.04]", inferred: "text-amber-200 border-amber-300/15 bg-amber-300/[0.04]", conflicting: "text-rose-200 border-rose-300/15 bg-rose-300/[0.04]", unsupported: "text-rose-200 border-rose-300/15 bg-rose-300/[0.04]", missing_evidence: "text-zinc-400 border-white/[0.07] bg-white/[0.02]", needs_ai_review: "text-sky-200 border-sky-300/15 bg-sky-300/[0.04]" };
const label = (value) => statusLabels[value] || String(value || "pending").replaceAll("_", " ");

export default function ReviewQueue({ caseId }) {
  const [claims, setClaims] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);
  const [editor, setEditor] = useState(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true); setError("");
    try {
      const [claimData, evidenceData, reviewData] = await Promise.all([listClaims(caseId, { signal }), listEvidence(caseId, { signal }), listReviews(caseId, { signal }).catch(() => [])]);
      const currentClaims = Array.isArray(claimData) ? claimData : [];
      setClaims(currentClaims); setEvidence(Array.isArray(evidenceData) ? evidenceData : []); setReviews(Array.isArray(reviewData) ? reviewData : []);
      setSelectedId((current) => currentClaims.some((claim) => claim._id === current) ? current : currentClaims.find((claim) => claim.reviewStatus === "pending")?._id || currentClaims[0]?._id || "");
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Review queue could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [caseId]);

  useEffect(() => { const controller = new AbortController(); Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);

  const pending = useMemo(() => claims.filter((claim) => claim.reviewStatus === "pending" || claim.reviewStatus === "needs_more_evidence"), [claims]);
  const selected = claims.find((claim) => claim._id === selectedId) || null;
  const evidenceMap = useMemo(() => new Map(evidence.map((record) => [String(record._id), record])), [evidence]);
  const selectedReviews = reviews.filter((review) => String(review.claimId) === String(selectedId));

  async function act(action, extra = {}) {
    if (!selected || working) return;
    setWorking(true); setActionError("");
    try {
      const result = await reviewClaim(selected._id, { action, comment: comment.trim(), ...extra });
      if (action === "edit" && result.claim) setSelectedId(result.claim._id);
      setComment(""); setEditor(null);
      await load();
    } catch (requestError) { setActionError(requestError.message || "Review action could not be saved."); }
    finally { setWorking(false); }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href={`/cases/${caseId}`} className="text-[10px] text-zinc-600 hover:text-zinc-300">Case overview</Link><h1 className="mt-3 text-[25px] font-semibold tracking-[-0.045em] text-zinc-100">Human review</h1><p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-zinc-500">Review source citations and verification separately. Approval is recorded by the backend and does not change the verification result.</p></div><button type="button" onClick={() => load()} disabled={loading} className="h-9 rounded-lg border border-white/[0.08] px-3 text-[10px] text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"><RotateCcw size={12} className="mr-2 inline" />Refresh</button></div>
      {error && <div role="alert" className="mt-5 rounded-lg border border-rose-300/10 bg-rose-300/[0.04] p-3 text-[10px] text-rose-200">{error}</div>}
      {loading ? <div className="mt-6 grid gap-4 xl:grid-cols-[340px_1fr]"><div className="h-96 animate-pulse rounded-xl bg-white/[0.03]" /><div className="h-96 animate-pulse rounded-xl bg-white/[0.03]" /></div> : <div className="mt-6 grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]"><section className="overflow-hidden rounded-xl border border-white/[0.065] bg-[#111114]"><div className="border-b border-white/[0.05] p-4"><h2 className="text-[12px] font-semibold text-zinc-200">Waiting for review</h2><p className="mt-1 text-[9px] text-zinc-600">{pending.length} claim(s) · {claims.length} total</p></div>{claims.length === 0 ? <div className="px-5 py-12 text-center"><CheckCheck size={20} className="mx-auto text-emerald-200/60" /><p className="mt-3 text-[10px] text-zinc-500">No claims to review yet.</p><Link href={`/cases/${caseId}/claims`} className="mt-2 inline-block text-[9px] text-violet-200">Open claims</Link></div> : <div className="max-h-[650px] divide-y divide-white/[0.04] overflow-y-auto">{claims.map((claim) => <button type="button" key={claim._id} onClick={() => { setSelectedId(claim._id); setActionError(""); }} className={`block w-full px-4 py-3.5 text-left hover:bg-white/[0.025] ${claim._id === selectedId ? "bg-violet-300/[0.035]" : ""}`}><div className="flex items-center justify-between gap-2"><span className="rounded border border-white/[0.06] px-1.5 py-1 text-[8px] capitalize text-zinc-500">{claim.claimType.replaceAll("_", " ")}</span><span className={`rounded border px-1.5 py-1 text-[8px] capitalize ${claim.reviewStatus === "approved" ? "border-emerald-300/10 text-emerald-200" : claim.reviewStatus === "rejected" ? "border-rose-300/10 text-rose-200" : "border-amber-300/10 text-amber-200"}`}>{label(claim.reviewStatus)}</span></div><p className="mt-2 line-clamp-3 text-[9px] leading-4 text-zinc-300">{claim.text}</p><p className="mt-2 text-[8px] text-zinc-600">Verification: <span className="capitalize">{label(claim.status)}</span> · {claim.evidenceIds?.length || 0} source(s)</p></button>)}</div>}</section>

        {!selected ? <section className="flex min-h-[400px] items-center justify-center rounded-xl border border-white/[0.065] bg-[#111114] text-center"><p className="text-[10px] text-zinc-600">Select a claim to inspect and review.</p></section> : <section className="rounded-xl border border-white/[0.065] bg-[#111114] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[8px] font-medium uppercase tracking-[0.12em] text-violet-200/70">Claim · v{selected.version} · {selected.claimType.replaceAll("_", " ")}</span><p className="mt-2 max-w-3xl text-[12px] leading-5 text-zinc-200">{selected.text}</p></div><div className="flex flex-col gap-1.5"><StateBadge labelText="Verification" value={label(selected.status)} valueStyle={verificationTone[selected.status]} /><StateBadge labelText="Human review" value={label(selected.reviewStatus)} /></div></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><div><h3 className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Supporting evidence and quotations</h3>{(selected.citations || []).length ? <div className="mt-2 space-y-2">{selected.citations.map((citation, index) => { const record = evidenceMap.get(String(citation.evidenceId)); return <div key={`${citation.evidenceId}-${index}`} className="rounded-lg border border-white/[0.06] bg-black/10 p-3"><p className="text-[10px] leading-5 text-emerald-100/75">“{citation.quote}”</p>{record ? <><Link href={`/cases/${caseId}/evidence?evidence=${record._id}`} className="mt-2 block truncate text-[8px] text-violet-200/70">{record.sourceName} · {record.locator}</Link><p className="mt-1 line-clamp-3 text-[9px] leading-4 text-zinc-600">{record.text}</p><p className="mt-1 text-[8px] text-zinc-700">{record.author || "Unknown"} · {record.accessLevel}</p></> : <p className="mt-2 text-[8px] text-zinc-700">Evidence record unavailable.</p>}</div>; })}</div> : <p className="mt-2 rounded-lg border border-amber-300/[0.09] p-3 text-[9px] text-amber-100/65">No exact citations are attached. Request more evidence or reject this claim.</p>}
            {selected.verification?.citationCheck?.failures?.length > 0 && <div className="mt-3 rounded-lg border border-rose-300/10 bg-rose-300/[0.025] p-3"><h4 className="text-[8px] font-medium uppercase tracking-wider text-rose-200/70">Citation issues</h4>{selected.verification.citationCheck.failures.map((failure, index) => <p key={`${failure.code}-${index}`} className="mt-1 text-[8px] text-zinc-500">{failure.message}</p>)}</div>}</div>
            <aside className="rounded-lg border border-white/[0.05] bg-black/10 p-3"><h3 className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Verification details</h3><p className="mt-2 text-[9px] leading-4 text-zinc-400">{selected.verification?.citationCheck?.valid ? "The cited quotations were found in their referenced evidence." : selected.verification?.citationCheck?.failures?.[0]?.message || "No successful citation validation is recorded."}</p><p className="mt-3 text-[8px] leading-4 text-zinc-600">Support check: {selected.verification?.supportCheck?.reason || "AI support verification is not configured."}</p><p className="mt-3 border-t border-white/[0.05] pt-3 text-[8px] text-zinc-600">Access level: {selected.accessLevel} · Confidence: {selected.confidence ?? "Not provided"}</p><h4 className="mt-4 text-[8px] font-semibold uppercase tracking-wider text-zinc-600">Review history</h4>{selectedReviews.length ? <div className="mt-2 space-y-2">{selectedReviews.map((review) => <div key={review._id} className="text-[8px] text-zinc-500"><span className="capitalize">{review.action.replaceAll("_", " ")}</span> · v{review.version}{review.comment && <p className="mt-1 leading-4 text-zinc-700">{review.comment}</p>}</div>)}</div> : <p className="mt-2 text-[8px] text-zinc-700">No review actions recorded.</p>}</aside></div>

          {editor && <EditDialog claim={selected} mode={editor} working={working} error={actionError} onClose={() => { setEditor(null); setActionError(""); }} onSubmit={(values) => act("edit", values)} />}
          {!editor && <div className="mt-5 border-t border-white/[0.055] pt-4"><label className="block text-[9px] text-zinc-500">Reviewer comment <span className="text-zinc-700">(optional)</span><textarea value={comment} maxLength={5000} onChange={(event) => setComment(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2 text-[9px] text-zinc-300 outline-none focus:border-violet-300/25" placeholder="Add the reason for your decision or what evidence is needed." /></label>{actionError && <p role="alert" className="mt-3 flex items-center gap-2 text-[9px] text-rose-200"><AlertCircle size={12} />{actionError}</p>}<div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" disabled={working} onClick={() => act("needs_more_evidence")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[9px] text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"><MessageSquareMore size={12} /> Request evidence</button><button type="button" disabled={working} onClick={() => act("reject")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-300/10 px-2.5 text-[9px] text-rose-200/80 hover:bg-rose-300/[0.04] disabled:opacity-50"><X size={12} /> Reject</button><button type="button" disabled={working} onClick={() => setEditor("edit")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 text-[9px] text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"><Pencil size={12} /> Edit</button><button type="button" disabled={working} onClick={() => act("approve")} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-300/90 px-2.5 text-[9px] font-semibold text-[#07130d] hover:bg-emerald-200 disabled:opacity-50">{working ? "Saving…" : <><Check size={12} /> Approve</>}</button></div><p className="mt-3 text-right text-[8px] text-zinc-700">Actions require an authorized reviewer; the API records every decision.</p></div>}
        </section>}
      </div>}
    </div>
  );
}

function StateBadge({ labelText, value, valueStyle = "border-white/[0.07] bg-white/[0.02] text-zinc-400" }) { return <span className={`inline-flex gap-1 rounded border px-2 py-1 text-[8px] capitalize ${valueStyle}`}><span className="opacity-55">{labelText}:</span>{value}</span>; }

function EditDialog({ claim, mode, working, error, onClose, onSubmit }) {
  const [text, setText] = useState(claim.text);
  const [confirmed, setConfirmed] = useState(false);
  function save() { if (!confirmed) return; onSubmit({ text: text.trim() }); }
  return <div className="mt-5 rounded-lg border border-violet-300/[0.12] bg-violet-300/[0.025] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-[10px] font-semibold text-zinc-200">Edit claim · version {claim.version} → {claim.version + 1}</h3><p className="mt-1 text-[8px] text-zinc-600">The current version and evidence references remain preserved.</p></div><button type="button" onClick={onClose} className="text-zinc-600 hover:text-zinc-200"><X size={14} /></button></div><div className="mt-3 rounded border border-white/[0.05] p-2.5"><p className="text-[8px] uppercase text-zinc-700">Previous version</p><p className="mt-1 text-[9px] leading-4 text-zinc-500">{claim.text}</p></div><label className="mt-3 block text-[9px] text-zinc-500">Updated claim text<textarea value={text} maxLength={5000} onChange={(event) => setText(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-black/10 px-3 py-2 text-[10px] text-zinc-200 outline-none focus:border-violet-300/25" /></label><label className="mt-3 flex items-start gap-2 text-[8px] leading-4 text-zinc-500"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-violet-300" />I reviewed the change. Saving creates a new claim version, resets human review to pending and re-runs citation checks.</label>{error && <p role="alert" className="mt-2 text-[9px] text-rose-200">{error}</p>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-8 rounded-lg px-3 text-[9px] text-zinc-500">Cancel</button><button type="button" disabled={!confirmed || !text.trim() || working} onClick={save} className="h-8 rounded-lg bg-violet-300 px-3 text-[9px] font-semibold text-[#100d1d] disabled:opacity-45">{working ? "Saving…" : "Confirm and save"}</button></div></div>;
}
