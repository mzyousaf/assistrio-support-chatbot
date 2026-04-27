import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteCustomerBotDocument, getCustomerBotDocument } from '../../../api/customerApi';
import { appToast } from '@/lib/app-toast';
import { KnowledgeDeleteConfirmModal } from './knowledgeSourcesListUi';
import { KnowledgeItemDetailPageShell, useKnowledgeDetailTab } from './knowledgeItemDetailShared';
import type { CustomerWorkspaceDocument } from '../../../api/types';
import { cn } from '@/lib/utils';
import { formatKbItemLastTrainedDateTime, kbItemTrainingStatusDotClassName } from './knowledgeViewTypes';

const PREVIEW_CHAR_LIMIT = 4000;

function trainingPipelineStatusLabel(s: string): string {
  const v = s.toLowerCase();
  if (v === 'ready') return 'Trained';
  if (v === 'processing' || v === 'uploading') return 'Training';
  if (v === 'failed') return 'Failed';
  if (v === 'queued') return 'Queued';
  return s || '—';
}

export function DocumentDetailPage() {
  const { id: botId, docId } = useParams<{ id: string; docId: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const [tab, setTab] = useKnowledgeDetailTab();
  const [doc, setDoc] = useState<CustomerWorkspaceDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!botId || !docId) return;
    setLoading(true);
    setLoadError(null);
    const res = await getCustomerBotDocument(botId, docId);
    if (!res.ok) {
      setLoadError(res.error);
      setDoc(null);
    } else {
      setDoc(res.data.document);
    }
    setLoading(false);
  }, [botId, docId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmRemove() {
    if (!botId || !docId) return;
    setDeleting(true);
    try {
      const res = await deleteCustomerBotDocument(botId, docId);
      if (!res.ok) {
        appToast.error('Could not remove', { description: res.error });
        return;
      }
      appToast.success('Document removed');
      setDeleteOpen(false);
      void navigate(`${base}/documents`, { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  const title = (doc?.title || doc?.fileName || 'Document').trim() || 'Document';
  const status = String(doc?.status ?? 'unknown').toLowerCase();
  const text = typeof doc?.text === 'string' ? doc.text : '';
  const preview = text.length > PREVIEW_CHAR_LIMIT ? `${text.slice(0, PREVIEW_CHAR_LIMIT)}…` : text;
  const isTruncated = text.length > PREVIEW_CHAR_LIMIT;

  if (!botId || !docId) return null;

  return (
    <>
      <KnowledgeItemDetailPageShell
        backLabel="Back to Documents"
        onBack={() => void navigate(`${base}/documents`)}
        sectionLabel="Documents"
        itemTitle={title}
        onEdit={() => void navigate(`${base}/documents/${docId}/edit`)}
        editDisabled={!doc}
        onDelete={() => setDeleteOpen(true)}
        deleteBusy={deleting}
        tab={tab}
        onTabChange={setTab}
        busy={loading}
        tabContent={
          loadError ? (
            <p className="m-0 text-sm text-red-600">{loadError}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document Content
                </h2>
                {text.trim() ? (
                  <div className="flex min-w-0 flex-col gap-2">
                    <pre
                      className={cn(
                        'm-0 max-h-[min(50vh,28rem)] overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-4',
                        'font-sans text-sm leading-relaxed whitespace-pre-wrap [word-break:break-word] text-slate-800',
                      )}
                    >
                      {preview}
                    </pre>
                    {isTruncated ? (
                      <p className="m-0 text-xs text-slate-500">
                        Showing first {PREVIEW_CHAR_LIMIT.toLocaleString()} characters. Open Edit to read or change the
                        full document content.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="m-0 text-sm text-slate-600">
                    {status === 'ready'
                      ? 'No content is stored for this file yet, or the document is empty after extraction. Open Edit to add content, or re-upload the file from the list.'
                      : 'Document content appears here after training finishes, or use Edit to set it now.'}
                  </p>
                )}
              </div>
            </div>
          )
        }
        analyticsContent={
          <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="m-0 text-sm font-semibold text-slate-900">Document</h2>
            {doc ? (
              <dl className="m-0 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Training status</dt>
                  <dd className="mt-0.5 flex items-center gap-2 text-slate-800">
                    <span
                      className={kbItemTrainingStatusDotClassName(
                        status === 'ready' ? 'ready' : status === 'failed' ? 'failed' : 'processing',
                      )}
                      aria-hidden
                    />
                    {trainingPipelineStatusLabel(status)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ingested</dt>
                  <dd className="mt-0.5 text-slate-800">
                    {formatKbItemLastTrainedDateTime(doc.ingestedAt != null ? String(doc.ingestedAt) : null)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">File</dt>
                  <dd className="mt-0.5 break-all text-slate-800">{doc.fileName || '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="m-0 text-sm text-slate-500">No metadata loaded.</p>
            )}
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
        title="Remove this document?"
        description="The file and its text will be removed from the assistant’s knowledge base."
        busy={deleting}
      />
    </>
  );
}
