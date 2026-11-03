"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, BookOpenCheck, Check, CircleHelp, LoaderCircle, MessageSquareText } from "lucide-react";
import { acknowledgeItem, generateHandover } from "@/services/handoverService";

function latestActions(handover) { const map = new Map(); for (const acknowledgement of handover?.acknowledgements || []) map.set(acknowledgement.itemId, acknowledgement); return map; }

export default function SuccessorHandover({ handoverId }) {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const [handover, setHandover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState({});
  const [working, setWorking] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    if (!caseId) { setError("This successor link is missing its case reference."); setLoading(false); return; }
    setLoading(true); setError("");
    try { const record = await generateHandover(caseId); setHandover(record); }
    catch (requestError) { setError(requestError.message || "Handover could not be opened."); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  async function acknowledge(itemId, action) {
    if (!handover || working) return;
    setWorking(itemId); setActionError("");
    try {
      const updated = await acknowledgeItem(handover._id || handoverId, { itemId, action, comment: comment[itemId]?.trim() || "" });
      setHandover(updated);
      setComment((current) => ({ ...current, [itemId]: "" }));
    } catch (requestError) { setActionError(requestError.message || "Acknowledgement could not be recorded."); }
    finally { setWorking(""); }
  }

  const actions = latestActions(handover);
  const allItems = handover?.sections?.flatMap((section) => section.items || []) || [];
  return <div className="mx-auto w-full max-w-[980px] px-5 pb-12 pt-8 sm:px-8">
    <header className="border-b border-white/[0.07] pb-6"><span className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-violet-200/70"><BookOpenCheck size={13} /> LegacyLoop · Successor handover</span><h1 className="mt-4 text-[26px] font-semibold tracking-[-0.045em] text-zinc-100">Your project handover</h1><p className="mt-2 max-w-2xl text-[11px] leading-5 text-zinc-500">Review approved project knowledge and record which items are clear or need follow-up.</p></header>
    {loading ? <div role="status" aria-live="polite" className="flex min-h-72 items-center justify-center gap-2 text-[10px] text-zinc-600"><LoaderCircle size={14} className="animate-spin" /> Loading handover…</div> : error ? <div className="mt-6 rounded-xl border border-rose-300/10 bg-rose-300/[0.035] p-5"><p role="alert" className="flex items-center gap-2 text-[10px] text-rose-200"><AlertCircle size={13} />{error}</p><p className="mt-2 text-[9px] leading-4 text-zinc-600">Open this page with the successor identity and role configured for the backend. The successor name must match the case record.</p><button type="button" onClick={load} className="mt-4 text-[9px] text-zinc-300 underline">Try again</button></div> : handover && <><div className="mt-5 flex flex-wrap gap-4 text-[9px] text-zinc-600"><span>Version {handover.version}</span><span className="capitalize">{handover.status.replaceAll("_", " ")}</span><span>{allItems.length} approved items available</span></div>{handover.role !== "successor" && <p className="mt-4 rounded-lg border border-amber-300/10 bg-amber-300/[0.025] p-3 text-[9px] leading-4 text-amber-100/70">This account is viewing as <span className="capitalize">{handover.role}</span>. Acknowledgement is available only to the successor identity configured for this case.</p>}{actionError && <p role="alert" className="mt-4 text-[9px] text-rose-200">{actionError}</p>}{allItems.length === 0 && <div className="mt-5 rounded-lg border border-white/[0.06] p-4 text-[10px] leading-5 text-zinc-600">No approved, permission-accessible claims are currently included in this handover. Ask the reviewer to approve eligible claims, then reopen this view.</div>}{handover.sections?.map((section) => <section key={section.key} className="border-b border-white/[0.06] py-5"><h2 className="text-[13px] font-semibold text-zinc-200">{section.title}</h2>{section.key === "project_overview" && section.context && <div className="mt-2 rounded-lg bg-white/[0.02] p-3"><p className="text-[10px] font-medium text-zinc-300">{section.context.projectName || section.context.title}</p>{section.context.description && <p className="mt-1 whitespace-pre-wrap text-[9px] leading-4 text-zinc-600">{section.context.description}</p>}</div>}{section.items?.map((item) => { const action = actions.get(item.id)?.action; return <article key={item.id} className="mt-3 rounded-xl border border-white/[0.06] bg-[#111114] p-4"><p className="text-[10px] leading-5 text-zinc-300">{item.text}</p>{item.citations?.length > 0 && <div className="mt-2 space-y-1">{item.citations.map((citation) => <Link key={citation.evidenceId} href={`/cases/${caseId}/evidence?evidence=${citation.evidenceId}`} className="block text-[8px] leading-4 text-violet-200/70 hover:text-violet-100">Evidence: {citation.sourceType} · {citation.sourceName} · {citation.locator} · “{citation.quote}”</Link>)}</div>}<div className="mt-4 border-t border-white/[0.05] pt-3">{action ? <p className={`flex items-center gap-1.5 text-[9px] ${action === "acknowledge" ? "text-emerald-200" : "text-amber-200"}`}>{action === "acknowledge" ? <Check size={12} /> : <CircleHelp size={12} />} {action === "request_clarification" ? "Clarification requested" : action === "unclear" ? "Marked unclear" : "Acknowledged"}{actions.get(item.id)?.comment && <span className="ml-1 text-zinc-600">· {actions.get(item.id).comment}</span>}</p> : handover.role !== "successor" ? <p className="text-[9px] text-zinc-700">Read-only for this role.</p> : <><label className="block text-[8px] text-zinc-600">Optional note<textarea maxLength={5000} rows={2} value={comment[item.id] || ""} onChange={(event) => setComment((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1.5 w-full rounded-md border border-white/[0.06] bg-black/10 px-2.5 py-2 text-[9px] text-zinc-300 outline-none focus:border-violet-300/20" placeholder="Add context if this needs follow-up." /></label><div className="mt-2 flex flex-wrap justify-end gap-2"><button type="button" disabled={Boolean(working)} onClick={() => acknowledge(item.id, "unclear")} className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.07] px-2 text-[8px] text-zinc-400 disabled:opacity-50"><CircleHelp size={11} /> Unclear</button><button type="button" disabled={Boolean(working)} onClick={() => acknowledge(item.id, "request_clarification")} className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300/10 px-2 text-[8px] text-amber-100/75 disabled:opacity-50"><MessageSquareText size={11} /> Request clarification</button><button type="button" disabled={Boolean(working)} onClick={() => acknowledge(item.id, "acknowledge")} className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-300/90 px-2 text-[8px] font-semibold text-[#07130d] disabled:opacity-50">{working === item.id ? "Saving…" : <><Check size={11} /> Acknowledge</>}</button></div></>}</div></article>; })}{!section.items?.length && section.missingInformation?.map((info) => <p key={info} className="mt-2 text-[9px] text-zinc-600">{info}</p>)}</section>)}<footer className="pt-5 text-[8px] text-zinc-700">Your acknowledgement applies to individual items. Items are not marked acknowledged automatically.</footer></>}
  </div>;
}
