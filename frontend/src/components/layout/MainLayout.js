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
    return <div className="app-shell min-h-screen bg-background"><a href="#main-content" className="sr-only z-50 rounded bg-violet-300 px-3 py-2 text-xs text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a><header className="flex h-[64px] items-center gap-3 border-b border-white/[0.06] bg-[#0b0a10]/90 px-5 backdrop-blur-xl sm:px-8"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-300/[0.07] text-violet-200"><Orbit size={16} aria-hidden="true" /></span><span className="text-[14px] font-semibold tracking-[-0.02em] text-zinc-100">LegacyLoop</span><span className="ml-auto rounded-full border border-violet-200/10 bg-violet-200/[0.045] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-violet-100/70">Successor view</span></header><main id="main-content" className="app-main">{children}</main></div>;
  }
  return (
    <div className="app-shell flex min-h-screen bg-background">
      <a href="#main-content" className="sr-only z-50 rounded bg-violet-300 px-3 py-2 text-xs text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} mobileOpen={mobileOpen} />
        <main id="main-content" className="app-main min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
