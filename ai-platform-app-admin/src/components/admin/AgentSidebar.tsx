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

import { AGENT_SIDEBAR_TREE, type AgentNavNode } from "@/components/admin/agent-sidebar-nav";
import { WORKSPACE_SIDEBAR_EXPANDED_PX } from "@/components/admin/agent-sidebar-layout";
import { getBotsBasePath } from "@/components/admin/admin-shell-config";
import { WorkspaceAssistantBlock } from "@/components/admin/WorkspaceAssistantBlock";
import { useLaunchReadinessSidebarState } from "@/contexts/LaunchReadinessSidebarContext";

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

function iconForPath(path: string): LucideIcon {
  if (path.startsWith("playground/")) {
    const tail = path.slice("playground/".length);
    return PLAYGROUND_TAIL_ICON[tail] ?? LineChart;
  }
  return INSIGHTS_ICON[path] ?? LineChart;
}

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

const SIDEBAR_PAD_X = "px-3";

/** Primary nav rows — Playground items & expandable parents. */
const MAIN_ROW =
  "flex w-full min-w-0 items-center gap-2.5 rounded-lg py-2 pl-2 pr-2 text-left text-[13px] font-medium leading-snug transition-colors duration-150";
const MAIN_ACTIVE =
  "bg-teal-50/90 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100";
const MAIN_INACTIVE =
  "text-slate-600 hover:bg-teal-50/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-100";

/** Expandable parent when a child route is active. */
const GROUP_PARENT_CHILD_ACTIVE =
  "bg-teal-50/70 text-brand-900 dark:bg-brand-500/12 dark:text-brand-100";

/** Nested sub-routes — plain text rows, no extra chrome. */
const SUB_ROW =
  "flex min-w-0 items-center rounded-md py-1.5 pl-2 pr-2 text-left text-[13px] leading-snug transition-colors duration-150";
const SUB_ACTIVE = "bg-teal-50/80 font-medium text-brand-800 dark:bg-brand-500/12 dark:text-brand-100";
const SUB_INACTIVE =
  "font-normal text-slate-600 hover:bg-teal-50/40 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/35 dark:hover:text-slate-200";

function isPathActive(currentSlug: string, itemPath: string): boolean {
  if (currentSlug === itemPath) return true;
  if (itemPath !== "" && currentSlug.startsWith(`${itemPath}/`)) return true;
  return false;
}

function navNodeKey(node: AgentNavNode, index: number): string {
  if (node.type === "link") return `link-${node.path}`;
  if (node.type === "group") return `group-${node.id}`;
  return `heading-${node.label}-${index}`;
}

function findGroupIdForActivePath(currentSlug: string): string | null {
  for (const node of AGENT_SIDEBAR_TREE) {
    if (node.type !== "group") continue;
    for (const child of node.children) {
      if (isPathActive(currentSlug, child.path)) return node.id;
    }
  }
  return null;
}

type AgentSidebarProps = {
  botId: string;
  theme: "light" | "dark";
  /** Agent display name (matches global header). */
  agentLabel?: string;
};

export function AgentSidebar({ botId, theme, agentLabel }: AgentSidebarProps) {
  const pathname = usePathname();
  const launchReadinessSidebar = useLaunchReadinessSidebarState();
  const showWorkspaceAssistantFooter = Boolean(
    launchReadinessSidebar?.snapshot && launchReadinessSidebar.snapshot.botId === botId,
  );
  const base = getBotsBasePath(pathname);
  const pathAfterBot = pathname.split(`/${botId}/`)[1]?.split("?")[0] ?? "";
  const currentSlug = pathAfterBot.replace(/\/$/, "");

  const linkBase = `${base}/${botId}`;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const next = new Set<string>();
    const active = findGroupIdForActivePath(currentSlug);
    if (active) next.add(active);
    return next;
  });

  useEffect(() => {
    const active = findGroupIdForActivePath(currentSlug);
    if (!active) return;
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.add(active);
      return n;
    });
  }, [currentSlug]);

  const handleToggleGroup = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        const activeGroup = findGroupIdForActivePath(currentSlug);
        if (next.has(id)) {
          if (activeGroup === id) return prev;
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [currentSlug],
  );

  function renderSectionLabelPrimary(label: string) {
    return (
      <div className="mb-3 px-1 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    );
  }

  function renderSectionLabelSecondary(label: string) {
    return (
      <>
        <div className="mb-1 mt-6 border-t border-teal-200/30 bg-gradient-to-b from-teal-50/20 to-transparent px-1 pt-5 dark:border-slate-700/60 dark:from-slate-900/40" />
        <div className="mb-3 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </>
    );
  }

  function renderTopLeaf(path: string, label: string, upcoming?: boolean) {
    const href = `${linkBase}/${path}`;
    const active = isPathActive(currentSlug, path);
    const Icon = iconForPath(path);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(MAIN_ROW, active ? MAIN_ACTIVE : MAIN_INACTIVE)}
      >
        <Icon
          className={cx("h-[17px] w-[17px] shrink-0", active ? "text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-500")}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {upcoming ? (
          <span
            className={cx(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500",
              theme === "dark" ? "bg-slate-800/90" : "bg-slate-100",
            )}
          >
            Soon
          </span>
        ) : null}
      </Link>
    );
  }

  function renderNestedLeaf(path: string, label: string, upcoming?: boolean) {
    const href = `${linkBase}/${path}`;
    const active = isPathActive(currentSlug, path);
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={cx(SUB_ROW, active ? SUB_ACTIVE : SUB_INACTIVE)}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {upcoming ? (
          <span
            className={cx(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500",
              theme === "dark" ? "bg-slate-800/90" : "bg-slate-100",
            )}
          >
            Soon
          </span>
        ) : null}
      </Link>
    );
  }

  function renderGroup(node: Extract<AgentNavNode, { type: "group" }>): ReactNode {
    const id = node.id;
    const expanded = expandedIds.has(id);
    const hasActiveChild = node.children.some((c) => isPathActive(currentSlug, c.path));
    const isKnowledge = id === "agent-playground-knowledge";
    const GroupIcon = isKnowledge ? BookOpen : PieChart;

    return (
      <div key={id} className="min-w-0">
        <button
          id={id}
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-panel`}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label} section`}
          className={cx(MAIN_ROW, "group/btn", hasActiveChild ? GROUP_PARENT_CHILD_ACTIVE : MAIN_INACTIVE)}
          onClick={() => handleToggleGroup(id)}
        >
          <GroupIcon
            className={cx(
              "h-[18px] w-[18px] shrink-0",
              hasActiveChild || expanded ? "text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-500",
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-left font-medium">{node.label}</span>
          <ChevronDown
            className={cx(
              "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={id}
          className={cx(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden" inert={expanded ? undefined : true}>
            <div className="ml-2 mt-0.5 space-y-0.5 border-l border-teal-200/35 py-0.5 pl-2 dark:border-slate-600/40">
              {node.children.map((c) => (
                <div key={c.path}>{renderNestedLeaf(c.path, c.label, c.upcoming)}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderNode(node: AgentNavNode, index: number): ReactNode {
    if (node.type === "heading") {
      if (node.label === "Insights") {
        return <div key={`h-${node.label}-${index}`}>{renderSectionLabelSecondary(node.label)}</div>;
      }
      return <div key={`h-${node.label}-${index}`}>{renderSectionLabelPrimary(node.label)}</div>;
    }
    if (node.type === "link") {
      return <div key={node.path}>{renderTopLeaf(node.path, node.label, node.upcoming)}</div>;
    }
    return renderGroup(node);
  }

  const displayName = agentLabel?.trim() || "Agent";

  return (
    <aside
      className={cx(
        "box-border flex h-full min-h-0 w-full min-w-0 shrink-0 flex-col",
        theme === "dark"
          ? "border-r border-slate-800/80 bg-slate-950/[0.45] shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.04)]"
          : "border-r border-teal-200/35 bg-gradient-to-b from-teal-50/30 via-white to-white shadow-[inset_-1px_0_0_0_rgba(20,184,166,0.06)]",
      )}
      style={{ maxWidth: "100%" }}
      data-agent-sidebar
      data-agent-sidebar-width={WORKSPACE_SIDEBAR_EXPANDED_PX}
    >
      <div
        className={cx(
          "shrink-0 pb-4 pt-4",
          SIDEBAR_PAD_X,
          theme === "dark" ? "border-b border-slate-800/80" : "border-b border-teal-100/80",
        )}
      >
        <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white" title={displayName}>
          {displayName}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Agent workspace</p>
      </div>

      <nav
        className={cx("flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overscroll-contain py-2", SIDEBAR_PAD_X)}
        aria-labelledby="agent-nav-heading"
      >
        <h2 id="agent-nav-heading" className="sr-only">
          Agent sections
        </h2>
        <div className="flex flex-col gap-1.5">{AGENT_SIDEBAR_TREE.map((node, i) => renderNode(node, i))}</div>
      </nav>

      {showWorkspaceAssistantFooter ? (
        <div
          className={cx(
            "sticky bottom-0 z-10 mt-auto w-full min-w-0 shrink-0 border-t pb-4 pt-3",
            SIDEBAR_PAD_X,
            theme === "dark"
              ? "border-slate-800/80 bg-slate-950/95 backdrop-blur-sm"
              : "border-teal-200/35 bg-white/90 backdrop-blur-sm",
          )}
        >
          <WorkspaceAssistantBlock botId={botId} theme={theme} />
        </div>
      ) : null}
    </aside>
  );
}
