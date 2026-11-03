"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Menu } from "lucide-react";

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
    <header className="sticky top-0 z-20 flex h-[64px] shrink-0 items-center justify-start border-b border-white/[0.065] bg-[#0b0a10]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenuClick} aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"><Menu size={19} /></button>
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="hidden text-zinc-500 sm:inline">Workspace</span>
          <ChevronRight size={14} className="hidden text-zinc-700 sm:block" />
          <span className="truncate font-medium text-zinc-200">{current}</span>
        </div>
      </div>
    </header>
  );
}
