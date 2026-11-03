"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, Plus, ShieldCheck, Sparkles } from "lucide-react";
import CaseList from "@/components/dashboard/CaseList";
import MetricCard from "@/components/dashboard/MetricCard";
import WorkflowCard from "@/components/dashboard/WorkflowCard";
import { listCases } from "@/services/caseService";
import Link from "next/link";

export default function DashboardView() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCases = useCallback(async (signal) => {
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
    Promise.resolve().then(() => loadCases(controller.signal));
    return () => controller.abort();
  }, [loadCases]);

  const metrics = useMemo(() => {
    const processing = cases.filter((item) => ["uploading", "processing"].includes(item.status)).length;
    const completed = cases.filter((item) => item.status === "completed").length;
    return { total: cases.length, processing, completed };
  }, [cases]);

  return (
    <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="surface-grid pointer-events-none absolute inset-x-0 top-0 h-[340px] opacity-40" />
      <div className="relative">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-300/10 bg-violet-300/[0.04] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.11em] text-violet-200/80"><Sparkles size={11} /> Knowledge continuity workspace</div>
            <h1 className="text-[25px] font-semibold tracking-[-0.045em] text-zinc-100 sm:text-[29px]">Good handovers start with evidence.</h1>
            <p className="mt-2 max-w-xl text-[12px] leading-5 text-zinc-500">Keep project knowledge traceable, reviewable, and ready for the next person.</p>
          </div>
          <Link href="/cases/new" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-violet-300/15 bg-violet-300/[0.08] px-3.5 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-300/[0.13]"><Plus size={14} /> New case</Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total cases" value={metrics.total} hint="Available to your account" icon={BriefcaseBusiness} loading={loading} />
          <MetricCard label="Processing" value={metrics.processing} hint="Uploading or processing" icon={Activity} accent="sky" loading={loading} />
          <MetricCard label="Pending reviews" value="—" hint="Not exposed by the current API" icon={Clock3} accent="amber" />
          <MetricCard label="Completed handovers" value={metrics.completed} hint="Cases marked completed" icon={CheckCircle2} accent="emerald" loading={loading} />
        </div>

        <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <CaseList cases={cases} loading={loading} error={error} onRetry={() => loadCases()} />
          <WorkflowCard />
        </div>

        <section className="mt-4 rounded-xl border border-white/[0.065] bg-[#111114] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-300/10 bg-emerald-300/[0.05] text-emerald-200"><ShieldCheck size={16} /></div>
            <div className="min-w-0 flex-1"><h2 className="text-[12px] font-semibold text-zinc-200">Knowledge risk overview</h2><p className="mt-1 text-[10px] leading-5 text-zinc-600">Risk signals will appear here when the analysis endpoints are available. LegacyLoop treats activity patterns as indicators, not proof of ownership.</p></div>
            <span className="hidden items-center gap-1 text-[9px] text-zinc-700 sm:flex">Analysis API <ArrowRight size={11} /></span>
          </div>
        </section>
        <p className="mt-5 text-center text-[9px] text-zinc-700">Evidence → Claims → Verification → Human review → Handover</p>
      </div>
    </div>
  );
}
