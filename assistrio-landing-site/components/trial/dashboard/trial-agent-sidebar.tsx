"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Cpu,
  LineChart,
  MessageSquare,
  MessagesSquare,
  Palette,
  PieChart,
  Rocket,
  SlidersHorizontal,
  Smile,
  Tags,
  UserCircle,
  Users,
} from "lucide-react";

import { TrialOnboardingRailCard } from "@/components/trial/dashboard/trial-onboarding-rail-card";
import { TrialWorkspaceQuotaCard } from "@/components/trial/dashboard/trial-workspace-quota-card";
import { useTrialDashboardSession } from "@/components/trial/dashboard/trial-dashboard-session-context";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import {
  TRIAL_AGENT_SIDEBAR_TREE,
  trialPreAgentHrefForSegment,
  trialSegmentIsTrialLocked,
  trialWorkspaceHref,
  type TrialAgentNavNode,
} from "@/lib/trial/trial-agent-workspace-nav";

const PLAYGROUND_TAIL_ICON: Record<string, LucideIcon> = {
  profile: UserCircle,
  behavior: SlidersHorizontal,
  knowledge: BookOpen,
  ai: Cpu,
  chat: MessageSquare,
  appearance: Palette,
  publish: Rocket,
};

const INSIGHTS_ICON: Record<string, LucideIcon> = {
  "insights/conversations": MessagesSquare,
  "insights/leads": Users,
  "insights/analytics/chats": BarChart3,
  "insights/analytics/topics": Tags,
  "insights/analytics/sentiment": Smile,
};

function iconForSegment(segment: string): LucideIcon {
  if (segment.startsWith("playground/")) {
    const tail = segment.slice("playground/".length);
    return PLAYGROUND_TAIL_ICON[tail] ?? LineChart;
  }
  return INSIGHTS_ICON[segment] ?? LineChart;
}

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

const SIDEBAR_PAD_X = "px-3";

const MAIN_ROW =
  "flex w-full min-w-0 items-center gap-2.5 rounded-lg py-2 pl-2 pr-2 text-left text-[13px] font-medium leading-snug transition-colors duration-150";
const MAIN_ACTIVE = "bg-teal-50/90 text-[var(--brand-teal-dark)] ring-1 ring-teal-200/50";
const MAIN_INACTIVE = "text-slate-600 hover:bg-teal-50/50 hover:text-slate-900";
const LOCKED_ROW = "text-slate-500 opacity-[0.92] hover:bg-slate-50/90 hover:text-slate-700";

const GROUP_PARENT_CHILD_ACTIVE = "bg-teal-50/70 text-[var(--brand-teal-dark)]";
const SUB_ROW =
  "flex min-w-0 items-center rounded-md py-1.5 pl-2 pr-2 text-left text-[13px] leading-snug transition-colors duration-150";
const SUB_ACTIVE = "bg-teal-50/80 font-medium text-[var(--brand-teal-dark)]";
const SUB_INACTIVE = "font-normal text-slate-600 hover:bg-teal-50/40 hover:text-slate-900";

function normalizePath(pathname: string): string {
  return pathname.split("?")[0]!.replace(/\/$/, "") || "";
}

function isSegmentActive(pathname: string, segment: string): boolean {
  const p = normalizePath(pathname);
  const full = `/trial/dashboard/${segment}`.replace(/\/$/, "");
  if (p === full) return true;
  if (segment.startsWith("playground/knowledge") && p === "/trial/dashboard/playground/knowledge") return true;
  return false;
}

function resolveHref(segment: string, hasAgent: boolean): string {
  if (!hasAgent) return trialPreAgentHrefForSegment(segment);
  return trialWorkspaceHref(segment);
}

function navNodeKey(node: TrialAgentNavNode, index: number): string {
  if (node.type === "link") return `link-${node.segment}`;
  if (node.type === "group") return `group-${node.id}`;
  return `heading-${node.label}-${index}`;
}

function findGroupIdForActivePath(pathname: string): string | null {
  for (const node of TRIAL_AGENT_SIDEBAR_TREE) {
    if (node.type !== "group") continue;
    for (const child of node.children) {
      if (isSegmentActive(pathname, child.segment)) return node.id;
    }
  }
  return null;
}

type Props = {
  mobileOpen: boolean;
  onNavigate: () => void;
};

export function TrialAgentSidebar({ mobileOpen, onNavigate }: Props) {
  const pathname = usePathname() ?? "";
  const { draft, hydrated } = useTrialWorkspaceDraft();
  const session = useTrialDashboardSession();
  const hasAgent = Boolean(draft.trialAgent?.botId);

  const displayName = (draft.trialAgent?.name?.trim() || draft.profile.agentName?.trim() || "Your agent").slice(0, 80);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const next = new Set<string>();
    const active = findGroupIdForActivePath(pathname);
    if (active) next.add(active);
    return next;
  });

  useEffect(() => {
    const active = findGroupIdForActivePath(pathname);
    if (!active) return;
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.add(active);
      return n;
    });
  }, [pathname]);

  const handleToggleGroup = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        const activeGroup = findGroupIdForActivePath(pathname);
        if (next.has(id)) {
          if (activeGroup === id) return prev;
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [pathname],
  );

  function rowClass(segment: string, active: boolean, locked: boolean): string {
    if (active) return cx(MAIN_ROW, MAIN_ACTIVE);
    if (locked) return cx(MAIN_ROW, LOCKED_ROW);
    return cx(MAIN_ROW, MAIN_INACTIVE);
  }

  function renderSectionLabelPrimary(label: string) {
    return (
      <div className="mb-3 px-1 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      </div>
    );
  }

  function renderSectionLabelSecondary(label: string) {
    return (
      <>
        <div className="mb-1 mt-6 border-t border-teal-200/30 bg-gradient-to-b from-teal-50/20 to-transparent px-1 pt-5" />
        <div className="mb-3 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        </div>
      </>
    );
  }

  function renderTopLeaf(segment: string, label: string, upcoming?: boolean) {
    const href = resolveHref(segment, hasAgent);
    const active = isSegmentActive(pathname, segment);
    const locked = hasAgent && trialSegmentIsTrialLocked(segment);
    const Icon = iconForSegment(segment);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(rowClass(segment, active, locked), "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35")}
        onClick={onNavigate}
      >
        <Icon className={cx("h-[17px] w-[17px] shrink-0", active ? "text-[var(--brand-teal)]" : "text-slate-500")} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {upcoming ? (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100">Soon</span>
        ) : locked ? (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100">Trial</span>
        ) : null}
      </Link>
    );
  }

  function renderNestedLeaf(segment: string, label: string, upcoming?: boolean) {
    const href = resolveHref(segment, hasAgent);
    const active = isSegmentActive(pathname, segment);
    const locked = hasAgent && trialSegmentIsTrialLocked(segment);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          SUB_ROW,
          active ? SUB_ACTIVE : SUB_INACTIVE,
          locked && "text-slate-500 opacity-90",
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35",
        )}
        onClick={onNavigate}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {upcoming ? (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100">Soon</span>
        ) : locked ? (
          <span className="shrink-0 text-[10px] font-medium text-slate-400">Trial</span>
        ) : null}
      </Link>
    );
  }

  function renderGroup(node: Extract<TrialAgentNavNode, { type: "group" }>): ReactNode {
    const id = node.id;
    const expanded = expandedIds.has(id);
    const hasActiveChild = node.children.some((c) => isSegmentActive(pathname, c.segment));
    const isKnowledge = id === "trial-playground-knowledge";
    const GroupIcon = isKnowledge ? BookOpen : PieChart;
    const anyLocked = hasAgent && node.children.some((c) => trialSegmentIsTrialLocked(c.segment));

    return (
      <div key={id} className="min-w-0">
        <button
          id={id}
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-panel`}
          className={cx(
            MAIN_ROW,
            "w-full",
            hasActiveChild ? GROUP_PARENT_CHILD_ACTIVE : MAIN_INACTIVE,
            anyLocked && !hasActiveChild ? "opacity-95" : null,
          )}
          onClick={() => handleToggleGroup(id)}
        >
          <GroupIcon
            className={cx(
              "h-[18px] w-[18px] shrink-0",
              hasActiveChild || expanded ? "text-[var(--brand-teal)]" : "text-slate-500",
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-left font-medium">{node.label}</span>
          <ChevronDown
            className={cx("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200", expanded && "rotate-180")}
            aria-hidden
          />
        </button>
        <div
          id={`${id}-panel`}
          role="region"
          className={cx("grid transition-[grid-template-rows] duration-200 ease-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
        >
          <div className="min-h-0 overflow-hidden" inert={expanded ? undefined : true}>
            <div className="ml-2 mt-0.5 space-y-0.5 border-l border-teal-200/35 py-0.5 pl-2">
              {node.children.map((c) => (
                <div key={c.segment}>{renderNestedLeaf(c.segment, c.label, c.upcoming)}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderNode(node: TrialAgentNavNode, index: number): ReactNode {
    if (node.type === "heading") {
      if (node.label === "Insights") {
        return <div key={navNodeKey(node, index)}>{renderSectionLabelSecondary(node.label)}</div>;
      }
      return <div key={navNodeKey(node, index)}>{renderSectionLabelPrimary(node.label)}</div>;
    }
    if (node.type === "link") {
      return <div key={node.segment}>{renderTopLeaf(node.segment, node.label, node.upcoming)}</div>;
    }
    return renderGroup(node);
  }

  return (
    <aside
      id="trial-agent-sidebar"
      className={cx(
        "fixed bottom-0 left-0 top-[var(--trial-header-h)] z-50 flex w-[min(18rem,92vw)] flex-col border-r border-teal-200/35 bg-gradient-to-b from-teal-50/30 via-white to-white shadow-[var(--shadow-md)] transition-transform duration-200 lg:static lg:top-auto lg:z-0 lg:h-full lg:w-[clamp(216px,28vw,288px)] lg:min-w-[216px] lg:max-w-[288px] lg:shrink-0 lg:translate-x-0 lg:shadow-[inset_-1px_0_0_0_rgba(20,184,166,0.06)]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
      style={{ maxWidth: "100%" }}
      aria-label="Agent workspace navigation"
    >
      <div className={cx("shrink-0 border-b border-teal-100/80 pb-3 pt-3", SIDEBAR_PAD_X)}>
        <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900" title={displayName}>
          {displayName}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Agent workspace</p>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain py-2", SIDEBAR_PAD_X)}>
          <TrialOnboardingRailCard draft={draft} hydrated={hydrated} hasTrialAgent={hasAgent} pathname={pathname} />
          <nav className="flex flex-col gap-1.5" aria-labelledby="trial-agent-nav-heading">
            <h2 id="trial-agent-nav-heading" className="sr-only">
              Agent sections
            </h2>
            {TRIAL_AGENT_SIDEBAR_TREE.map((node, i) => renderNode(node, i))}
          </nav>
        </div>

        <div className={cx("shrink-0 border-t border-slate-200/80 bg-white/90 py-2.5 backdrop-blur-sm", SIDEBAR_PAD_X)}>
          <TrialWorkspaceQuotaCard platformVisitorId={session.platformVisitorId} />
        </div>
      </div>
    </aside>
  );
}
