"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, Orbit, X } from "lucide-react";
import { caseNavigation, utilityNavigation, workspaceNavigation } from "@/constants/navigation";

function NavRow({ item, active, collapsed, onNavigate }) {
  const Icon = item.icon;
  const classes = `group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
    active
      ? "bg-violet-300/[0.10] text-violet-50 shadow-[inset_2px_0_0_0_rgba(196,181,253,0.9),inset_0_0_0_1px_rgba(196,181,253,0.10)]"
      : item.disabled
        ? "cursor-not-allowed text-zinc-600"
        : "text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100"
  } ${collapsed ? "justify-center px-0" : ""}`;
  const contents = <><Icon size={17} strokeWidth={1.8} className={active ? "text-violet-300" : "shrink-0"} /><span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>{item.disabled && !collapsed && <span className="ml-auto text-[9px] font-medium text-zinc-600">{item.disabledLabel || "SOON"}</span>}{active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-300" />}</>;

  if (item.disabled || !item.href) {
    return <div aria-disabled="true" title={collapsed ? item.label : undefined} className={classes}>{contents}</div>;
  }
  return <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} className={classes}>{contents}</Link>;
}

function SidebarContents({ collapsed, onNavigate, pathname }) {
  const routeCase = pathname.match(/^\/cases\/([^/]+)/)?.[1];
  const currentCase = routeCase && routeCase !== "new" ? routeCase : null;
  const isCasesPage = pathname === "/cases" || pathname === "/cases/new";
  return (
    <>
      <div className={`flex h-[76px] items-center ${collapsed ? "justify-center px-3" : "gap-3 px-5"}`}>
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-300/[0.16] to-violet-300/[0.04] text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Orbit size={19} strokeWidth={1.8} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#0d0d10] bg-emerald-400" />
        </div>
        {!collapsed && <div className="min-w-0"><div className="text-[14px] font-semibold tracking-[-0.03em] text-zinc-100">LegacyLoop</div><div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.17em] text-zinc-600">Knowledge transfer</div></div>}
      </div>

      <div className="mx-4 h-px bg-white/[0.055]" />
      <nav aria-label="Workspace navigation" className="flex-1 px-3 pt-6">
        {!collapsed && <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">Workspace</div>}
        <div className="space-y-1">{workspaceNavigation.map((item) => <NavRow key={item.label} item={item} active={item.href === pathname || (item.href === "/cases" && isCasesPage)} collapsed={collapsed} onNavigate={onNavigate} />)}</div>

        <div className={`my-6 h-px bg-white/[0.055] ${collapsed ? "mx-2" : "mx-1"}`} />
        {!collapsed && <div className="mb-2 flex items-center justify-between px-3"><span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">Case workspace</span>{currentCase && <span className="max-w-20 truncate rounded bg-white/[0.045] px-1.5 py-0.5 text-[9px] text-zinc-500">{currentCase.slice(0, 7)}</span>}</div>}
        <div className="space-y-1">{caseNavigation.map((item) => {
          const available = Boolean(currentCase) && !item.disabled;
          const href = currentCase ? `/cases/${currentCase}${item.suffix}` : null;
          return <NavRow key={item.label} item={{ ...item, href, disabled: !available, disabledLabel: currentCase ? "SOON" : "OPEN CASE" }} active={available && (item.suffix ? pathname.endsWith(item.suffix) : pathname === `/cases/${currentCase}`)} collapsed={collapsed} onNavigate={onNavigate} />;
        })}</div>
      </nav>

      <div className="px-3 pb-3">
        <div className="space-y-1">{utilityNavigation.map((item) => <NavRow key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />)}</div>
        <div className={`mt-3 flex items-center rounded-xl border border-white/[0.06] bg-white/[0.025] ${collapsed ? "justify-center p-2" : "gap-3 p-2.5"}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-[11px] font-semibold text-zinc-300">LL</div>
          {!collapsed && <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium text-zinc-300">Local workspace</div><div className="mt-0.5 text-[10px] text-zinc-600">Developer access</div></div>}
          {!collapsed && <ArrowUpRight size={14} className="text-zinc-600" />}
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const mobileNavigationRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeMobile = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
      }
      if (event.key !== "Tab") return;
      const controls = [...(mobileNavigationRef.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]') || [])];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [closeMobile, mobileOpen]);

  return (
    <>
      <aside className={`relative z-30 hidden shrink-0 flex-col border-r border-white/[0.065] bg-[#0c0b10] transition-[width] duration-200 md:flex ${collapsed ? "w-[76px]" : "w-[260px]"}`}>
        <SidebarContents collapsed={collapsed} pathname={pathname} />
        <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="absolute -right-3 top-[88px] flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#17171b] text-zinc-500 shadow-lg transition-colors hover:text-zinc-200">
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </aside>

      <AnimatePresence>
        {mobileOpen && <>
          <motion.button type="button" aria-label="Close navigation menu" onClick={closeMobile} initial={{ opacity: prefersReducedMotion ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: prefersReducedMotion ? 1 : 0 }} transition={prefersReducedMotion ? { duration: 0 } : undefined} className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] md:hidden" />
          <motion.aside id="mobile-navigation" ref={mobileNavigationRef} role="dialog" aria-modal="true" aria-label="Mobile navigation" initial={{ x: prefersReducedMotion ? 0 : -280 }} animate={{ x: 0 }} exit={{ x: prefersReducedMotion ? 0 : -280 }} transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }} className="fixed inset-y-0 left-0 z-50 flex w-[min(280px,85vw)] flex-col border-r border-white/[0.08] bg-[#0c0b10] shadow-2xl md:hidden">
            <button ref={closeButtonRef} type="button" onClick={closeMobile} aria-label="Close navigation" className="absolute right-3 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/[0.06] hover:text-white"><X size={17} /></button>
            <SidebarContents collapsed={false} pathname={pathname} onNavigate={closeMobile} />
          </motion.aside>
        </>}
      </AnimatePresence>
    </>
  );
}
