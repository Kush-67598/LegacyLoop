import { Activity, BookOpenCheck, Boxes, CircleHelp, FileSearch, FolderKanban, Gauge, GitBranch, Settings2 } from "lucide-react";

export const workspaceNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "All cases", href: "/cases", icon: FolderKanban }
];

export const caseNavigation = [
  { label: "Overview", suffix: "", icon: Activity },
  { label: "Evidence", suffix: "/evidence", icon: FileSearch },
  { label: "Ownership", suffix: "/ownership", icon: GitBranch },
  { label: "Claims", suffix: "/claims", icon: Boxes },
  { label: "Review queue", suffix: "/review", icon: BookOpenCheck },
  { label: "Handover", suffix: "/handover", icon: CircleHelp }
];

export const utilityNavigation = [
  { label: "Settings", icon: Settings2, disabled: true }
];
