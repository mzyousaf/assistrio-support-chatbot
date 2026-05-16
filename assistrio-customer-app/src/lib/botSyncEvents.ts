/** Dispatched after `BotWorkspaceContext.softReload` succeeds so the shell navbar can refetch agent summary. */
export const ASSISTRIO_NAVBAR_BOT_REFRESH = 'assistrio-navbar-refresh-bot';

/**
 * Dispatched so workspace UIs can refetch lightweight state without a full app reload.
 *
 * **Knowledge base:** Listener `TrainingStatusSidebarCard` + `KnowledgeOverviewPage` call
 * `GET …/knowledge/training/status` and `GET …/knowledge/overview` (respectively). Invoke
 * `requestWorkspaceBotRefresh(botId, { affectedSections: [...] })` after KB mutations so the sidebar stays aligned
 * without refetching every section’s `/knowledge/status` when only one area changed.
 */
export const ASSISTRIO_WORKSPACE_BOT_REFRESH = 'assistrio-workspace-refresh-bot';

/**
 * Dispatched after successful POST `/knowledge/training/retrain-agent` so KB section UIs can
 * refetch typed `GET …/knowledge/status?type=…` for affected sections only.
 * When `affectedTypes` is missing or empty, listeners must not fan out to every section.
 */
export const ASSISTRIO_KB_TRAINING_STARTED = 'assistrio-kb-training-started';

/** Aligns with `GET …/knowledge/status?type` query parameter. */
export type KbTrainingAffectedType =
  | 'document'
  | 'faq'
  | 'note'
  | 'table'
  | 'suggestion';

export const KB_TRAINING_AFFECTED_ALL: readonly KbTrainingAffectedType[] = [
  'document',
  'faq',
  'note',
  'table',
  'suggestion',
];

/** Sections backed by `GET …/knowledge/status?type=…` — alias for {@link KbTrainingAffectedType}. */
export type KnowledgeStatusSection = KbTrainingAffectedType;

export type WorkspaceBotRefreshDetail = {
  botId: string;
  /**
   * When set, listeners should refetch typed KB status only for these sections (not all five).
   * Omit for path / registered-section fallback in `KbWorkspacePollingProvider`.
   */
  affectedSections?: KnowledgeStatusSection[];
  /**
   * Drop cached GET `/documents` list so revisiting Documents cannot hydrate a stale row/total count.
   * Prefer this name over legacy {@link WorkspaceBotRefreshDetail.invalidateDocumentsListCache}.
   */
  refreshDocumentsList?: boolean;
  /** Drop cached GET `/documents` list (legacy callers). */
  invalidateDocumentsListCache?: boolean;
  /** Optional analytics / future debugging — not logged by default. */
  reason?: string;
};

export type RequestWorkspaceBotRefreshOptions = {
  affectedSections?: KnowledgeStatusSection[];
  refreshDocumentsList?: boolean;
  invalidateDocumentsListCache?: boolean;
  reason?: string;
};

export type AssistroKbTrainingStartedDetail = {
  botId: string;
  /** Sections to refresh; omit or leave empty when nothing was queued (no broad refetch). */
  affectedTypes?: KbTrainingAffectedType[];
};

export function dispatchKbTrainingStarted(detail: AssistroKbTrainingStartedDetail): void {
  window.dispatchEvent(new CustomEvent(ASSISTRIO_KB_TRAINING_STARTED, { detail }));
}

export function requestNavbarBotRefresh(botId: string): void {
  window.dispatchEvent(new CustomEvent(ASSISTRIO_NAVBAR_BOT_REFRESH, { detail: { botId } }));
}

export function requestWorkspaceBotRefresh(botId: string, opts?: RequestWorkspaceBotRefreshOptions): void {
  const o = opts ?? {};
  const refreshDocumentsList =
    o.refreshDocumentsList === true || o.invalidateDocumentsListCache === true;
  const detail: WorkspaceBotRefreshDetail = {
    botId,
    ...(refreshDocumentsList
      ? { refreshDocumentsList: true, invalidateDocumentsListCache: true }
      : {}),
    ...(o.affectedSections != null && o.affectedSections.length > 0
      ? { affectedSections: o.affectedSections }
      : {}),
    ...(typeof o.reason === 'string' && o.reason.trim() !== '' ? { reason: o.reason.trim() } : {}),
  };
  window.dispatchEvent(new CustomEvent(ASSISTRIO_WORKSPACE_BOT_REFRESH, { detail }));
}

/** Alias: same event as {@link requestWorkspaceBotRefresh} — use after KB saves for explicit call sites. */
export const requestKbGlobalTrainingStatusRefresh = requestWorkspaceBotRefresh;
