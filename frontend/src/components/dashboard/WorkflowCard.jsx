import { ArrowDown, CheckCheck, FileCheck2, GitBranch, ShieldCheck } from "lucide-react";

const steps = [
  { label: "Evidence", detail: "Source records are collected", icon: GitBranch },
  { label: "Claims", detail: "Statements link back to sources", icon: FileCheck2 },
  { label: "Human review", detail: "A reviewer checks the claims", icon: CheckCheck },
  { label: "Handover", detail: "The successor receives approved knowledge", icon: ShieldCheck }
];

export default function WorkflowCard() {
  return (
    <section className="rounded-xl border border-white/[0.065] bg-[#111114] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-[13px] font-semibold text-zinc-200">Evidence to handover</h2><p className="mt-1 text-[10px] leading-5 text-zinc-600">Knowledge moves forward only after it is sourced and reviewed.</p></div><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300/10 bg-violet-300/[0.06] text-violet-200"><ShieldCheck size={16} /></div></div>
      <div className="mt-5 space-y-1">
        {steps.map((step, index) => { const Icon = step.icon; return <div key={step.label}>
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.045] text-zinc-400"><Icon size={14} strokeWidth={1.8} /></div><div className="min-w-0 flex-1"><div className="text-[11px] font-medium text-zinc-300">{step.label}</div><div className="mt-0.5 truncate text-[9px] text-zinc-600">{step.detail}</div></div><span className="text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-700">{index === 0 ? "Source" : "Next"}</span></div>
          {index < steps.length - 1 && <div className="flex h-4 items-center pl-[23px] text-zinc-700"><ArrowDown size={11} strokeWidth={1.5} /></div>}
        </div>; })}
      </div>
      <div className="mt-4 rounded-lg border border-violet-300/[0.09] bg-violet-300/[0.035] px-3 py-2.5 text-[10px] leading-[1.65] text-zinc-500">A summary is not enough. Every important statement should remain traceable to evidence.</div>
    </section>
  );
}
