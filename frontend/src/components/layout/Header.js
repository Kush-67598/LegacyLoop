"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Command, Menu, Search } from "lucide-react";

const routeLabels = {
  dashboard: "Dashboard",
  cases: "Cases",
  new: "New case",
  evidence: "Evidence",
  ownership: "Ownership",
  claims: "Claims",
  review: "Review queue",
  handover: "Handover"
};

export default function Header({ onMenuClick, mobileOpen }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const current = parts[0] === "cases" && parts.length === 2 && parts[1] !== "new"
    ? "Case overview"
    : routeLabels[parts.at(-1)] || "Workspace";
  return (
    <header className="sticky top-0 z-20 flex h-[64px] shrink-0 items-center justify-between border-b border-white/[0.065] bg-[#09090b]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenuClick} aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"><Menu size={19} /></button>
        <div className="flex min-w-0 items-center gap-2 text-[12px]">
          <span className="hidden text-zinc-600 sm:inline">Workspace</span>
          <ChevronRight size={13} className="hidden text-zinc-700 sm:block" />
          <span className="truncate font-medium text-zinc-300">{current}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button disabled type="button" aria-label="Search is not available yet" className="hidden h-9 w-[220px] items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-left text-[11px] text-zinc-600 transition-colors lg:flex xl:w-[260px]">
          <Search size={14} /><span className="flex-1">Search cases, evidence...</span><kbd className="flex items-center gap-0.5 rounded border border-white/[0.07] px-1 py-0.5 text-[9px]"><Command size={9} /> K</kbd>
        </button>
        <span className="hidden h-5 w-px bg-white/[0.08] sm:block" />
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-300/15 bg-violet-400/10 text-[10px] font-semibold text-violet-200">LW</div>
          <div className="hidden min-w-0 sm:block"><div className="text-[11px] font-medium text-zinc-300">Workspace</div><div className="mt-0.5 text-[10px] text-zinc-600">Local development</div></div>
        </div>
      </div>
    </header>
  );
}
