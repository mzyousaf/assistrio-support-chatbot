import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useNotifyAdminKbItemDeletedOnce } from '@/lib/adminResourceUnavailable';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { hydrateExampleQuestionsFromBot } from '../exampleQuestionHelpers';
import { KNOWLEDGE_ITEM_PAGE_SHELL_CLASS } from './knowledgeItemDetailShared';
import { KnowledgeBackBreadcrumbRow } from './knowledgeSourcesListUi';
import { cn } from '@/lib/utils';
import {
  datasheetsFromBot,
  faqsFromBot,
  snippetsFromBot,
  workspaceQaPrimaryLabel,
} from './knowledgeViewTypes';

/** Parent layout passes this through `<Outlet context={…}>` so edit or detail can refresh the crumb label without remounting breadcrumbs. */
export type KnowledgeItemLiveCrumbOutletContext = {
  setLiveLastCrumb: (label: string | null) => void;
  setBreadcrumbsHidden: (hidden: boolean) => void;
};

/** Hide the shared layout breadcrumb row while async content (e.g. document load on edit) is in flight. */
export function useKnowledgeItemBreadcrumbsHiddenWhile(hidden: boolean): void {
  const ctx = useOutletContext<KnowledgeItemLiveCrumbOutletContext | undefined>();
  useLayoutEffect(() => {
    if (!ctx?.setBreadcrumbsHidden) return;
    ctx.setBreadcrumbsHidden(hidden);
    return () => ctx.setBreadcrumbsHidden(false);
  }, [ctx, hidden]);
}

/** Keep layout breadcrumbs in sync with edit-form title chips (mounted under {@link KnowledgeItemLiveCrumbOutletContext}). */
export function useSyncKnowledgeLiveCrumb(displayLabel: string): void {
  const ctx = useOutletContext<KnowledgeItemLiveCrumbOutletContext | undefined>();
  useLayoutEffect(() => {
    if (!ctx) return;
    const t = displayLabel.trim();
    ctx.setLiveLastCrumb(t || null);
    return () => ctx.setLiveLastCrumb(null);
  }, [ctx, displayLabel]);
}

export function SnippetItemRouteLayout() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bot, loadState } = useAdminBotWorkspace();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const fromBot = useMemo(() => snippetsFromBot(bot), [bot]);
  const notifyKbDeleted = useNotifyAdminKbItemDeletedOnce(botId, indexParam);
  const [liveCrumb, setLiveCrumb] = useState<string | null>(null);
  const [breadcrumbsHidden, setBreadcrumbsHidden] = useState(false);

  const isEdit = /\/snippets\/[^/]+\/edit\/?$/.test(location.pathname);

  useEffect(() => {
    setLiveCrumb(null);
    setBreadcrumbsHidden(false);
  }, [indexParam, location.pathname]);

  useEffect(() => {
    if (indexParam === 'new') void navigate(`${base}/notes`, { replace: true });
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      notifyKbDeleted();
      void navigate(`${base}/notes`, { replace: true });
    }
  }, [loadState, bot, numIndex, fromBot.length, indexParam, navigate, base, notifyKbDeleted]);

  const row =
    Number.isFinite(numIndex) && numIndex >= 0 && numIndex < fromBot.length ? fromBot[numIndex]! : null;
  const fallbackCrumb =
    row != null
      ? ((row.title || `Snippet ${numIndex + 1}`).trim() || `Snippet ${numIndex + 1}`)
      : '';
  const lastCrumb = ((isEdit ? liveCrumb ?? fallbackCrumb : fallbackCrumb) || 'Untitled').trim() || 'Untitled';

  const outletCtx = useMemo<KnowledgeItemLiveCrumbOutletContext>(
    () => ({ setLiveLastCrumb: setLiveCrumb, setBreadcrumbsHidden }),
    [],
  );

  if (!botId || indexParam === 'new') return null;
  if (loadState !== 'ok' || !bot) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }
  if (!row) return null;

  return (
    <div className={KNOWLEDGE_ITEM_PAGE_SHELL_CLASS} data-knowledge-snippet-item-layout>
      {breadcrumbsHidden ? null : (
        <div className="shrink-0">
          <KnowledgeBackBreadcrumbRow
            backLabel={isEdit ? 'Back' : 'Back to Snippets'}
            onBack={() => void navigate(isEdit ? `${base}/notes/${numIndex}` : `${base}/notes`)}
            sectionLabel="Snippets"
            lastCrumb={lastCrumb}
            tailLabel={isEdit ? 'Edit' : undefined}
          />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet context={outletCtx} />
      </div>
    </div>
  );
}

export function QaItemRouteLayout() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bot, loadState } = useAdminBotWorkspace();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const fromBot = useMemo(() => (bot ? faqsFromBot(bot) : []), [bot]);
  const notifyKbDeleted = useNotifyAdminKbItemDeletedOnce(botId, indexParam);
  const [liveCrumb, setLiveCrumb] = useState<string | null>(null);
  const [breadcrumbsHidden, setBreadcrumbsHidden] = useState(false);
  const isEdit = /\/faqs\/[^/]+\/edit\/?$/.test(location.pathname);

  useEffect(() => {
    setLiveCrumb(null);
    setBreadcrumbsHidden(false);
  }, [indexParam, location.pathname]);

  useEffect(() => {
    if (indexParam === 'new') void navigate(`${base}/faqs`, { replace: true });
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      notifyKbDeleted();
      void navigate(`${base}/faqs`, { replace: true });
    }
  }, [loadState, bot, numIndex, fromBot.length, indexParam, navigate, base, notifyKbDeleted]);

  const row =
    Number.isFinite(numIndex) && numIndex >= 0 && numIndex < fromBot.length ? fromBot[numIndex]! : null;

  const fallbackCrumb = row ? workspaceQaPrimaryLabel(row, `Q&A ${numIndex + 1}`) : '';
  const lastCrumb = ((isEdit ? liveCrumb ?? fallbackCrumb : fallbackCrumb) || 'Untitled').trim() || 'Untitled';

  const outletCtx = useMemo<KnowledgeItemLiveCrumbOutletContext>(
    () => ({ setLiveLastCrumb: setLiveCrumb, setBreadcrumbsHidden }),
    [],
  );

  if (!botId || indexParam === 'new') return null;
  if (loadState !== 'ok' || !bot) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }
  if (!row) return null;

  return (
    <div className={KNOWLEDGE_ITEM_PAGE_SHELL_CLASS} data-knowledge-faq-item-layout>
      {breadcrumbsHidden ? null : (
        <div className="shrink-0">
          <KnowledgeBackBreadcrumbRow
            backLabel={isEdit ? 'Back' : 'Back to Q&A'}
            onBack={() => void navigate(isEdit ? `${base}/faqs/${numIndex}` : `${base}/faqs`)}
            sectionLabel="Q&A"
            lastCrumb={lastCrumb}
            tailLabel={isEdit ? 'Edit' : undefined}
          />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet context={outletCtx} />
      </div>
    </div>
  );
}

export function KnowledgeSuggestionItemRouteLayout() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bot, loadState } = useAdminBotWorkspace();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const fromBot = useMemo(() => hydrateExampleQuestionsFromBot(bot), [bot]);
  const notifyKbDeleted = useNotifyAdminKbItemDeletedOnce(botId, indexParam);
  const [liveCrumb, setLiveCrumb] = useState<string | null>(null);
  const [breadcrumbsHidden, setBreadcrumbsHidden] = useState(false);
  const isEdit = /\/suggestions\/[^/]+\/edit\/?$/.test(location.pathname);

  useEffect(() => {
    setLiveCrumb(null);
    setBreadcrumbsHidden(false);
  }, [indexParam, location.pathname]);

  useEffect(() => {
    if (indexParam === 'new') void navigate(`${base}/suggestions`, { replace: true });
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      notifyKbDeleted();
      void navigate(`${base}/suggestions`, { replace: true });
    }
  }, [loadState, bot, numIndex, fromBot.length, indexParam, navigate, base, notifyKbDeleted]);

  const row =
    Number.isFinite(numIndex) && numIndex >= 0 && numIndex < fromBot.length ? fromBot[numIndex]! : null;

  const fallbackCrumb =
    row != null
      ? ((row.label || `Suggestion ${numIndex + 1}`).trim() || `Suggestion ${numIndex + 1}`)
      : '';
  const lastCrumb = ((isEdit ? liveCrumb ?? fallbackCrumb : fallbackCrumb) || 'Untitled').trim() || 'Untitled';

  const outletCtx = useMemo<KnowledgeItemLiveCrumbOutletContext>(
    () => ({ setLiveLastCrumb: setLiveCrumb, setBreadcrumbsHidden }),
    [],
  );

  if (!botId || indexParam === 'new') return null;
  if (loadState !== 'ok' || !bot) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }
  if (!row) return null;

  return (
    <div className={KNOWLEDGE_ITEM_PAGE_SHELL_CLASS} data-knowledge-suggestion-item-layout>
      {breadcrumbsHidden ? null : (
        <div className="shrink-0">
          <KnowledgeBackBreadcrumbRow
            backLabel={isEdit ? 'Back' : 'Back to Suggestions'}
            onBack={() => void navigate(isEdit ? `${base}/suggestions/${numIndex}` : `${base}/suggestions`)}
            sectionLabel="Suggestions"
            lastCrumb={lastCrumb}
            tailLabel={isEdit ? 'Edit' : undefined}
          />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet context={outletCtx} />
      </div>
    </div>
  );
}

export function DocumentItemRouteLayout() {
  const { id: botId, docId } = useParams<{ id: string; docId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const [liveCrumb, setLiveCrumb] = useState<string | null>(null);
  const [breadcrumbsHidden, setBreadcrumbsHidden] = useState(false);
  const isEdit = /\/documents\/[^/]+\/edit\/?$/.test(location.pathname);

  useEffect(() => {
    setLiveCrumb(null);
    setBreadcrumbsHidden(false);
  }, [docId, location.pathname]);

  const lastCrumb = (liveCrumb?.trim() || 'Document').trim() || 'Document';

  const outletCtx = useMemo<KnowledgeItemLiveCrumbOutletContext>(
    () => ({ setLiveLastCrumb: setLiveCrumb, setBreadcrumbsHidden }),
    [],
  );

  if (!botId || !docId) return null;

  return (
    <div className={KNOWLEDGE_ITEM_PAGE_SHELL_CLASS} data-knowledge-document-item-layout>
      {breadcrumbsHidden ? null : (
        <div className="shrink-0">
          <KnowledgeBackBreadcrumbRow
            backLabel={isEdit ? 'Back' : 'Back to Documents'}
            onBack={() =>
              void navigate(isEdit ? `${base}/documents/${encodeURIComponent(docId)}` : `${base}/documents`)
            }
            sectionLabel="Documents"
            lastCrumb={lastCrumb}
            tailLabel={isEdit ? 'Edit' : undefined}
          />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet context={outletCtx} />
      </div>
    </div>
  );
}

export function DatasheetItemRouteLayout() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { bot, loadState } = useAdminBotWorkspace();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const fromBot = useMemo(() => (bot ? datasheetsFromBot(bot) : []), [bot]);
  const notifyKbDeleted = useNotifyAdminKbItemDeletedOnce(botId, indexParam);
  const [liveCrumb, setLiveCrumb] = useState<string | null>(null);
  const [breadcrumbsHidden, setBreadcrumbsHidden] = useState(false);

  const isFullscreen = /\/fullscreen\/?$/.test(location.pathname);
  const isEditLane = /\/edit\/?$/.test(location.pathname) && !isFullscreen;

  useEffect(() => {
    setLiveCrumb(null);
    setBreadcrumbsHidden(false);
  }, [indexParam, location.pathname]);

  useEffect(() => {
    if (!indexParam || indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      notifyKbDeleted();
      void navigate(`${base}/datasheets`, { replace: true });
    }
  }, [loadState, bot, numIndex, fromBot.length, indexParam, navigate, base, notifyKbDeleted]);

  const table =
    Number.isFinite(numIndex) && numIndex >= 0 && numIndex < fromBot.length ? fromBot[numIndex]! : null;

  const fallbackCrumb =
    table != null
      ? ((table.title || `Datasheet ${numIndex + 1}`).trim() || `Datasheet ${numIndex + 1}`)
      : '';

  const useLive = isFullscreen || isEditLane;
  const lastCrumb = ((useLive ? liveCrumb ?? fallbackCrumb : fallbackCrumb) || 'Untitled').trim() || 'Untitled';

  const tailLabel = isFullscreen ? 'Full screen' : isEditLane ? 'Edit' : undefined;

  const backLabel = isFullscreen ? 'Exit full screen' : isEditLane ? 'Back' : 'Back to Datasheets';
  const outletCtx = useMemo<KnowledgeItemLiveCrumbOutletContext>(
    () => ({ setLiveLastCrumb: setLiveCrumb, setBreadcrumbsHidden }),
    [],
  );

  function onDatasheetCrumbBack() {
    if (isFullscreen) void navigate('../edit', { relative: 'path' });
    else if (isEditLane) void navigate('..', { relative: 'path' });
    else void navigate(`${base}/datasheets`);
  }

  if (!botId) return null;
  if (loadState !== 'ok' || !bot) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }
  if (!table) return null;

  return (
    <div
      className={cn(
        KNOWLEDGE_ITEM_PAGE_SHELL_CLASS,
        isFullscreen && 'pt-2 sm:pt-3',
      )}
      data-knowledge-datasheet-item-layout
    >
      {breadcrumbsHidden ? null : (
        <div className={cn('shrink-0', isFullscreen && 'px-2 sm:px-4')}>
          <KnowledgeBackBreadcrumbRow
            backLabel={backLabel}
            onBack={() => void onDatasheetCrumbBack()}
            sectionLabel="Datasheets"
            lastCrumb={lastCrumb}
            tailLabel={tailLabel}
          />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet context={outletCtx} />
      </div>
    </div>
  );
}
