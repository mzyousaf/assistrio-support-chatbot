import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import {
  getCustomerBotDocument,
  patchCustomerBotDocument,
} from '../../../api/customerApi';
import { appToast } from '@/lib/app-toast';
import { Button, FieldRow, Input, Modal, Textarea } from '@/components/ui';
import { KnowledgeBackBreadcrumbRow, KnowledgeSaveConfirmModal } from './knowledgeSourcesListUi';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { CustomerWorkspaceDocument } from '../../../api/types';

export function DocumentEditPage() {
  const { id: botId, docId } = useParams<{ id: string; docId: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';

  const [doc, setDoc] = useState<CustomerWorkspaceDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [titleEditOpen, setTitleEditOpen] = useState(false);
  const [titleModalDraft, setTitleModalDraft] = useState('');
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!botId || !docId) return;
    setLoading(true);
    setLoadError(null);
    const res = await getCustomerBotDocument(botId, docId);
    if (!res.ok) {
      setLoadError(res.error);
      setDoc(null);
    } else {
      const d = res.data.document;
      setDoc(d);
      setTitle((d.title || d.fileName || '').trim() || 'Document');
      setText(typeof d.text === 'string' ? d.text : '');
    }
    setLoading(false);
  }, [botId, docId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayTitle = (title.trim() || 'Document').trim() || 'Document';

  const openTitleEdit = useCallback(() => {
    setTitleModalDraft(displayTitle);
    setTitleEditOpen(true);
  }, [displayTitle]);

  const titleModalUnchanged = useMemo(() => {
    const t = titleModalDraft.trim() || 'Document';
    const current = displayTitle;
    return t === current;
  }, [titleModalDraft, displayTitle]);

  const saveTitleFromModal = useCallback(async () => {
    if (!botId || !docId) return;
    const t = titleModalDraft.trim() || 'Document';
    if (t === displayTitle) {
      setTitleEditOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await patchCustomerBotDocument(botId, docId, { title: t });
      if (!res.ok) {
        appToast.error('Could not update title', { description: res.error });
        return;
      }
      appToast.success('Title updated');
      setTitle(t);
      setTitleEditOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }, [botId, docId, titleModalDraft, displayTitle, load]);

  function requestUpdateChanges() {
    if (!text.trim()) {
      appToast.error('Document content cannot be empty');
      return;
    }
    setUpdateConfirmOpen(true);
  }

  async function confirmUpdateChanges() {
    if (!botId || !docId) return;
    const tx = text;
    if (!tx.trim()) {
      setUpdateConfirmOpen(false);
      appToast.error('Document content cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const res = await patchCustomerBotDocument(botId, docId, {
        text: tx,
        title: displayTitle,
      });
      if (!res.ok) {
        appToast.error('Could not update document', { description: res.error });
        return;
      }
      appToast.success('Document updated. Training will run again with your changes.');
      setUpdateConfirmOpen(false);
      void navigate(`${base}/documents/${docId}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  if (!botId || !docId) return null;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 px-0 pb-8">
        <div className="shrink-0">
          <KnowledgeBackBreadcrumbRow
            backLabel="Back to Documents"
            onBack={() => void navigate(`${base}/documents`)}
            sectionLabel="Documents"
            lastCrumb="Document"
            tailLabel="Edit"
          />
        </div>
        <p className="m-0 text-sm text-red-600">{loadError ?? 'Document not found.'}</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0 pb-10"
      data-knowledge-document-editor
    >
      <div className="shrink-0">
        <KnowledgeBackBreadcrumbRow
          backLabel="Back"
          onBack={() => void navigate(`${base}/documents/${docId}`)}
          sectionLabel="Documents"
          lastCrumb={displayTitle}
          tailLabel="Edit"
        />
      </div>

      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0 !mb-0')}>
        <div className={cn(styles.workspaceEditorTitleBlock, 'max-w-2xl')}>
          <div className="inline-flex w-full min-w-0 max-w-full items-center gap-1.5">
            <h1
              className={cn(
                styles.workspaceEditorH1,
                'm-0 min-w-0 max-w-[calc(100%-1.75rem)] flex-1 truncate !leading-tight !tracking-tight',
              )}
              title={displayTitle}
            >
              {displayTitle}
            </h1>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-m-0.5 h-7 w-7 shrink-0 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={openTitleEdit}
              disabled={saving}
              title="Edit document name"
              aria-label="Edit document name"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
          <p className={cn(styles.workspaceEditorLeadFull, 'mb-0 mt-2')}>
            Updating re-runs training so the assistant can use the updated text in replies.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={styles.knowledgeFormActionSecondary}
            onClick={() => void navigate(`${base}/documents/${docId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={styles.knowledgeFormActionPrimary}
            disabled={saving}
            onClick={requestUpdateChanges}
          >
            Update Changes
          </Button>
        </div>
      </header>

      <div className="shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <p className="mb-3 mt-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Document Content</p>
        <div className="w-full min-w-0">
          <Textarea
            id="doc-edit-text"
            quiet
            rows={16}
            className="min-h-[12rem] w-full font-sans text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={saving}
            placeholder="Extracted or edited document content…"
          />
        </div>
      </div>

      <Modal
        open={titleEditOpen}
        onClose={() => {
          if (saving) return;
          setTitleEditOpen(false);
        }}
        allowDismiss={!saving}
        title="Document name"
        description="Shown in your knowledge library and in retrieval."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              onClick={() => setTitleEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={styles.knowledgeModalActionPrimary}
              disabled={saving || titleModalUnchanged}
              aria-busy={saving}
              onClick={() => void saveTitleFromModal()}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </>
        }
      >
        <FieldRow label="Title" htmlFor="doc-title-modal" helperText="A short, recognizable name for this document.">
          <Input
            id="doc-title-modal"
            quiet
            className="w-full min-w-0"
            value={titleModalDraft}
            onChange={(e) => setTitleModalDraft(e.target.value)}
            autoComplete="off"
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!saving && !titleModalUnchanged) {
                  void saveTitleFromModal();
                }
              }
            }}
          />
        </FieldRow>
      </Modal>

      <KnowledgeSaveConfirmModal
        open={updateConfirmOpen}
        onClose={() => {
          if (saving) return;
          setUpdateConfirmOpen(false);
        }}
        onConfirm={() => void confirmUpdateChanges()}
        title="Update document?"
        description="Your changes are saved to this assistant’s knowledge base and training runs again with the new content."
        confirmLabel="Update Changes"
        busyLabel="Updating…"
        busy={saving}
      />
    </div>
  );
}
