"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Orbit } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  if (pathname.startsWith("/successor/")) {
    return <div className="min-h-screen bg-background"><a href="#main-content" className="sr-only z-50 rounded bg-violet-300 px-3 py-2 text-xs text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a><header className="flex h-14 items-center gap-2 border-b border-white/[0.06] px-5 sm:px-8"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-300/[0.06] text-violet-200"><Orbit size={15} aria-hidden="true" /></span><span className="text-[12px] font-semibold text-zinc-200">LegacyLoop</span><span className="ml-auto text-[9px] uppercase tracking-wider text-zinc-700">Successor view</span></header><div id="main-content">{children}</div></div>;
  }
  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main-content" className="sr-only z-50 rounded bg-violet-300 px-3 py-2 text-xs text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} mobileOpen={mobileOpen} />
        <main id="main-content" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
