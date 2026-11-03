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
    <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 sm:pt-10 xl:px-10">
      <div className="surface-grid pointer-events-none absolute inset-x-0 top-0 h-[300px] opacity-20" />
      <div className="relative">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-violet-200/80"><Sparkles size={13} /> Knowledge continuity</div>
            <h1 className="max-w-3xl text-[30px] font-semibold leading-[1.12] tracking-[-0.045em] text-zinc-100 sm:text-[36px]">Good handovers start with evidence.</h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-zinc-400">Keep project knowledge traceable, reviewable, and ready for the next person.</p>
          </div>
          <Link href="/cases/new" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-violet-200/20 bg-violet-300 px-4 text-[12px] font-semibold text-[#171221] transition-colors hover:bg-violet-200"><Plus size={16} /> New case</Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total cases" value={metrics.total} hint="Available to your account" icon={BriefcaseBusiness} loading={loading} />
          <MetricCard label="Processing" value={metrics.processing} hint="Uploading or processing" icon={Activity} accent="sky" loading={loading} />
          <MetricCard label="Pending reviews" value="—" hint="Not exposed by the current API" icon={Clock3} accent="amber" />
          <MetricCard label="Completed handovers" value={metrics.completed} hint="Cases marked completed" icon={CheckCircle2} accent="emerald" loading={loading} />
        </div>

        <div className="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <CaseList cases={cases} loading={loading} error={error} onRetry={() => loadCases()} />
          <WorkflowCard />
        </div>

        <section className="mt-5 rounded-lg border border-white/[0.075] bg-[#111114] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-300/10 bg-emerald-300/[0.05] text-emerald-200"><ShieldCheck size={18} /></div>
            <div className="min-w-0 flex-1"><h2 className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-100">Knowledge risk overview</h2><p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-zinc-500">Risk signals will appear here when the analysis endpoints are available. LegacyLoop treats activity patterns as indicators, not proof of ownership.</p></div>
            <span className="hidden items-center gap-1 text-[11px] text-zinc-600 sm:flex">Analysis API <ArrowRight size={13} /></span>
          </div>
        </section>
        <p className="mt-6 text-center text-[11px] text-zinc-600">Evidence <span className="px-1.5 text-zinc-700">→</span> Claims <span className="px-1.5 text-zinc-700">→</span> Verification <span className="px-1.5 text-zinc-700">→</span> Human review <span className="px-1.5 text-zinc-700">→</span> Handover</p>
      </div>
    </div>
  );
}
