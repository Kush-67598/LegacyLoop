import { CheckCheck, FileCheck2, GitBranch, ShieldCheck } from "lucide-react";

const steps = [
  { label: "Evidence", detail: "Source records are collected", icon: GitBranch },
  { label: "Claims", detail: "Statements link back to sources", icon: FileCheck2 },
  { label: "Human review", detail: "A reviewer checks the claims", icon: CheckCheck },
  { label: "Handover", detail: "The successor receives approved knowledge", icon: ShieldCheck }
];

export default function WorkflowCard() {
  return (
    <section className="rounded-lg border border-white/[0.075] bg-[#111114] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-[16px] font-semibold tracking-[-0.02em] text-zinc-100">Evidence to handover</h2><p className="mt-1.5 text-[12px] leading-5 text-zinc-500">A clear path from source records to reviewed knowledge.</p></div><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-violet-300/10 bg-violet-300/[0.06] text-violet-200"><ShieldCheck size={18} /></div></div>
      <div className="mt-6 space-y-2.5">
        {steps.map((step, index) => { const Icon = step.icon; return <div key={step.label} className="relative">
          {index > 0 && <div aria-hidden="true" className="absolute -top-2 left-[19px] h-2 border-l border-violet-200/15" />}
          <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#151519] px-3 py-3.5 transition-colors hover:border-violet-200/15"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.04] bg-violet-300/[0.055] text-violet-100/80"><Icon size={17} strokeWidth={1.8} /></div><div className="min-w-0 flex-1"><div className="text-[14px] font-medium text-zinc-200">{step.label}</div><div className="mt-1 text-[12px] leading-4 text-zinc-500">{step.detail}</div></div><span className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-600">{index === 0 ? "Start" : `${index + 1} / ${steps.length}`}</span></div>
        </div>; })}
      </div>
      <div className="mt-5 border-t border-white/[0.07] pt-4 text-[11px] leading-5 text-zinc-500">Every important statement stays linked to its source evidence.</div>
    </section>
  );
}
