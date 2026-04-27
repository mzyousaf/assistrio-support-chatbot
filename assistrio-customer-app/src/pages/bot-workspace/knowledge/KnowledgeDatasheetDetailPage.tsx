import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Pencil, Table2 } from 'lucide-react';
import { patchCustomerBot } from '../../../api/customerApi';
import { appToast } from '@/lib/app-toast';
import { Button } from '@/components/ui';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { cn } from '@/lib/utils';
import { ws } from '../workspace';
import { KnowledgeDeleteConfirmModal } from './knowledgeSourcesListUi';
import {
  KnowledgeItemDetailPageShell,
  KnowledgeItemTrainingAnalytics,
  useKnowledgeDetailTab,
} from './knowledgeItemDetailShared';
import { datasheetsFromBot, formatKbFileSizeDisplay, formatKbItemLastTrainedDateTime } from './knowledgeViewTypes';

const PREVIEW_ROWS = 10;

function DatasheetDetailPreviewOverlay({ onOpenFullscreen }: { onOpenFullscreen: () => void }) {
  return (
    <div className="absolute inset-0 z-[1] min-h-[12rem]">
      <div
        className="absolute inset-0 bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]"
        aria-hidden
      />
      <div className="relative z-[1] flex h-full min-h-0 flex-col">
        <div className="h-[18%] min-h-8 shrink-0" aria-hidden />
        <div className="flex w-full shrink-0 justify-center px-2">
          <div
            className="max-w-[22rem] rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 text-center shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05]"
            role="status"
          >
            <div
              className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-teal-600)] text-white shadow-sm"
              aria-hidden
            >
              <Table2 className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <p className="m-0 text-sm font-semibold leading-snug text-slate-900">Edit Datasheet</p>
            <p className={cn(ws.workspaceEditorControlHint, 'mt-1.5 text-pretty')}>
              This is a read-only preview. Open the full-screen editor to work with the full table.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={cn('mt-4 w-full', ws.knowledgeFormActionPrimary)}
              onClick={onOpenFullscreen}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Edit in full screen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeDatasheetDetailPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const [tab, setTab] = useKnowledgeDetailTab();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fromBot = useMemo(() => (bot ? datasheetsFromBot(bot) : []), [bot]);
  const table = !Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length ? null : fromBot[numIndex]!;

  useEffect(() => {
    if (loadState !== 'ok' || !bot) return;
    if (!table) {
      void navigate(`${base}/datasheets`, { replace: true });
    }
  }, [loadState, bot, table, navigate, base]);

  async function confirmRemove() {
    if (!botId || !table || numIndex < 0) return;
    setDeleting(true);
    try {
      const next = fromBot.filter((_, i) => i !== numIndex);
      const res = await patchCustomerBot(botId, { knowledgeDatasheets: next });
      if (!res.ok) {
        appToast.error('Could not remove', { description: res.error });
        return;
      }
      setDeleteOpen(false);
      appToast.success('Datasheet removed');
      await softReload();
      void navigate(`${base}/datasheets`, { replace: true });
    } finally {
      setDeleting(false);
    }
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

  const displayTitle = (table.title || `Datasheet ${numIndex + 1}`).trim() || `Datasheet ${numIndex + 1}`;
  const columns = table.columns;
  const preview = table.rows.slice(0, PREVIEW_ROWS);
  const colSpan = Math.max(1, columns.length);

  return (
    <>
      <KnowledgeItemDetailPageShell
        backLabel="Back to Datasheets"
        onBack={() => void navigate(`${base}/datasheets`)}
        sectionLabel="Datasheets"
        itemTitle={displayTitle}
        onEdit={() => void navigate(`${base}/datasheets/${numIndex}/edit`)}
        onDelete={() => setDeleteOpen(true)}
        deleteBusy={deleting}
        tab={tab}
        onTabChange={setTab}
        tabContent={
          <div className="space-y-3">
            {columns.length === 0 ? (
              <p className="m-0 rounded-xl border border-slate-200/90 bg-white p-4 text-sm text-slate-600">
                This datasheet has no columns yet.
              </p>
            ) : (
              <div className="relative overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <p className="m-0 border-b border-slate-100 px-3 py-2 text-xs text-slate-500 sm:px-4">
                  Showing first {Math.min(PREVIEW_ROWS, table.rows.length)} of {table.rows.length.toLocaleString()} data
                  rows
                </p>
                <div className="relative min-h-[14rem]">
                  <table className="w-full min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90">
                        <th className="w-10 px-2 py-2 text-center text-xs font-semibold text-slate-500">#</th>
                        {columns.map((c, ci) => (
                          <th
                            key={ci}
                            className="min-w-[100px] max-w-[14rem] whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-slate-700"
                          >
                            {c.trim() || `Column ${ci + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.length === 0 ? (
                        <tr>
                          <td
                            colSpan={colSpan + 1}
                            className="px-3 py-6 text-center text-sm text-slate-500"
                          >
                            No rows yet
                          </td>
                        </tr>
                      ) : (
                        preview.map((row, ri) => (
                          <tr
                            key={ri}
                            className={cn('border-b border-slate-100', ri % 2 === 1 ? 'bg-slate-50/50' : 'bg-white')}
                          >
                            <td className="px-2 py-2 text-center text-xs font-medium tabular-nums text-slate-500">
                              {ri + 1}
                            </td>
                            {columns.map((_, ci) => (
                              <td key={ci} className="min-w-[100px] max-w-[14rem] px-2 py-2 align-top text-slate-800">
                                <span className="line-clamp-3 break-words [overflow-wrap:anywhere]">
                                  {row[ci] ?? ''}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <DatasheetDetailPreviewOverlay
                    onOpenFullscreen={() => void navigate(`${base}/datasheets/${numIndex}/fullscreen`)}
                  />
                </div>
              </div>
            )}
          </div>
        }
        analyticsContent={
          <div className="space-y-4">
            <KnowledgeItemTrainingAnalytics
              status={table.trainingStatus}
              lastTrainedAt={table.lastTrainedAt}
            />
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h2 className="m-0 text-sm font-semibold text-slate-900">File</h2>
              <dl className="mt-3 m-0 grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Source</dt>
                  <dd className="m-0 min-w-0 text-right text-slate-800" title={table.importFileName ?? undefined}>
                    {table.importFileName || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Size</dt>
                  <dd className="m-0 text-slate-800">{formatKbFileSizeDisplay(table.importFileSize ?? null)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Last trained (detail)</dt>
                  <dd className="m-0 text-slate-800">{formatKbItemLastTrainedDateTime(table.lastTrainedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        }
      />
      <KnowledgeDeleteConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={() => void confirmRemove()}
        title="Remove this datasheet?"
        description="The entire datasheet (including all rows) is removed from the assistant’s knowledge base. This cannot be undone."
        busy={deleting}
      />
    </>
  );
}
