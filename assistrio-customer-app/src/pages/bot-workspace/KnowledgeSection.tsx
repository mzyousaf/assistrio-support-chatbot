import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';
import {
  deleteCustomerBotDocument,
  getCustomerBotDocumentDownloadUrl,
  getCustomerBotDocuments,
  patchCustomerBot,
  patchCustomerBotDocument,
  postCustomerBotDocumentUpload,
} from '../../api/customerApi';
import { useBotWorkspace } from './BotWorkspaceContext';

import { ws as styles } from './workspace';
import { DataPageLayout } from '@/layout/workspace-layout';
import { Button, Input, Textarea } from '@/components/ui';

const dangerLinkBtn =
  'h-auto min-h-0 px-0 py-0 text-[0.8125rem] font-normal text-[var(--color-danger-text-emphasis)] underline hover:bg-transparent';

function docId(row: Record<string, unknown>): string {
  const id = row._id;
  if (id && typeof id === 'object' && id !== null && 'toString' in id) {
    return String((id as { toString(): string }).toString());
  }
  return String(id ?? '');
}

function statusBadgeClass(status: string | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'queued') return styles.badgeQueued;
  if (s === 'processing') return styles.badgeProcessing;
  if (s === 'ready') return styles.badgeReady;
  if (s === 'failed') return styles.badgeFailed;
  return styles.badgeUnknown;
}

/** Ready + included in the assistant — matches backend rules for a signed download URL. */
function rowMayHaveDownloadableFile(row: Record<string, unknown>): boolean {
  const st = String(row.status ?? '').toLowerCase();
  return st === 'ready' && row.active !== false;
}

type FaqRow = { question: string; answer: string };

export function KnowledgeSection() {
  const { id: routeBotId } = useParams();
  const { pathname } = useLocation();
  const { bot, botId, reload: reloadBot } = useBotWorkspace();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, unknown> | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [snippet, setSnippet] = useState('');
  const [faqs, setFaqs] = useState<FaqRow[]>([{ question: '', answer: '' }]);
  const [kbSaving, setKbSaving] = useState(false);
  const [kbMsg, setKbMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [fileAccessLoadingId, setFileAccessLoadingId] = useState<string | null>(null);
  const [fileAccessErr, setFileAccessErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocs = useCallback(async () => {
    if (!botId) return;
    const wid = botId;
    setDocLoading(true);
    setDocErr(null);
    const res = await getCustomerBotDocuments(wid, { page: 1, limit: 50 });
    setDocLoading(false);
    if (!res.ok) {
      setDocErr(res.error);
      setRows([]);
      return;
    }
    setRows((res.data.documents as Record<string, unknown>[]) ?? []);
    setTotal(res.data.total ?? 0);
    setCounts(res.data.counts ?? null);
  }, [botId]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const hasPendingIngestion = rows.some((r) => {
    const s = String(r.status ?? '').toLowerCase();
    return s === 'queued' || s === 'processing';
  });

  useEffect(() => {
    if (!botId || !hasPendingIngestion) return;
    const t = window.setInterval(() => void loadDocs(), 4000);
    return () => window.clearInterval(t);
  }, [botId, hasPendingIngestion, loadDocs]);

  useEffect(() => {
    if (!bot) return;
    setSnippet(String(bot.knowledgeDescription ?? ''));
    const raw = Array.isArray(bot.faqs) ? bot.faqs : [];
    const fr: FaqRow[] = raw
      .map((f) => ({
        question: String(f.question ?? ''),
        answer: String(f.answer ?? ''),
      }))
      .filter((f) => f.question || f.answer);
    setFaqs(fr.length ? fr : [{ question: '', answer: '' }]);
  }, [bot]);

  if (!bot || !botId) return null;
  const id = botId;
  const base = routeBotId ? `/bots/${routeBotId}` : '';
  const knowledgeTab: 'files' | 'text' | 'qa' = (pathname.endsWith('/knowledge/qa') || pathname.endsWith('/knowledge/faqs'))
    ? 'qa'
    : (pathname.endsWith('/knowledge/text') || pathname.endsWith('/knowledge/notes'))
      ? 'text'
      : 'files';

  function knowledgeTabClass(active: boolean): string {
    return `${styles.knowledgeTab} ${active ? styles.knowledgeTabActive : ''}`;
  }

  async function toggleDocActive(docId: string, active: boolean) {
    const res = await patchCustomerBotDocument(id, docId, { active });
    if (!res.ok) {
      setDocErr(res.error);
      return;
    }
    void loadDocs();
  }

  async function removeDoc(docId: string) {
    setPendingDelete(null);
    const res = await deleteCustomerBotDocument(id, docId);
    if (!res.ok) {
      setDocErr(res.error);
      return;
    }
    void loadDocs();
    void reloadBot();
  }

  async function openOrDownloadDocumentFile(documentId: string, mode: 'open' | 'download') {
    if (!botId) return;
    const row = rows.find((r) => docId(r) === documentId);
    const rawName = row ? String(row.fileName ?? row.title ?? 'document') : 'document';
    const safeName = rawName.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'document';
    setFileAccessLoadingId(documentId);
    setFileAccessErr(null);
    const res = await getCustomerBotDocumentDownloadUrl(botId, documentId);
    setFileAccessLoadingId(null);
    if (!res.ok) {
      setFileAccessErr(
        res.status === 404
          ? 'This file is not available to open yet. It may still be processing, failed, or excluded from the assistant.'
          : res.error,
      );
      return;
    }
    const url = res.data && typeof res.data === 'object' && res.data && 'url' in res.data ? String((res.data as { url?: unknown }).url ?? '') : '';
    if (!url || !/^https?:\/\//i.test(url)) {
      setFileAccessErr('Could not get a valid link. Please try again.');
      return;
    }
    if (mode === 'open') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  async function onUploadFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !botId) return;
    setUploadMsg(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const t = uploadTitle.trim();
    if (t) fd.append('title', t);
    const res = await postCustomerBotDocumentUpload(botId, fd);
    setUploading(false);
    if (!res.ok) {
      setUploadMsg({ type: 'err', text: res.error });
      return;
    }
    setUploadMsg({
      type: 'ok',
      text: `Uploaded “${res.data.document.title}”. It is queued for processing; status updates automatically.`,
    });
    setUploadTitle('');
    void loadDocs();
    void reloadBot();
  }

  async function saveTextKnowledge(e: React.FormEvent) {
    e.preventDefault();
    setKbMsg(null);
    const cleanedFaqs = faqs
      .map((f) => ({
        question: f.question.trim(),
        answer: f.answer.trim(),
        active: true as const,
      }))
      .filter((f) => f.question && f.answer);
    if (!snippet.trim() && cleanedFaqs.length === 0) {
      setKbMsg({
        type: 'err',
        text: 'Add a text snippet and/or at least one FAQ with both question and answer.',
      });
      return;
    }
    setKbSaving(true);
    const res = await patchCustomerBot(id, {
      knowledgeDescription: snippet.trim(),
      faqs: cleanedFaqs,
    });
    setKbSaving(false);
    if (!res.ok) {
      setKbMsg({ type: 'err', text: res.error });
      return;
    }
    setKbMsg({ type: 'ok', text: 'Text knowledge saved.' });
    void reloadBot();
  }

  return (
    <DataPageLayout
      title="Knowledge base"
      description="Files for search, plus text and Q&amp;A stored on the assistant record."
      containerSize="wide"
    >
      <nav className={styles.knowledgeTabs} aria-label="Knowledge sections">
        <NavLink to={`${base}/knowledge/documents`} className={() => knowledgeTabClass(knowledgeTab === 'files')}>
          Documents
        </NavLink>
        <NavLink to={`${base}/knowledge/notes`} className={() => knowledgeTabClass(knowledgeTab === 'text')}>
          Notes
        </NavLink>
        <NavLink to={`${base}/knowledge/faqs`} className={() => knowledgeTabClass(knowledgeTab === 'qa')}>
          FAQs
        </NavLink>
      </nav>

      {knowledgeTab === 'files' ? (
        <section className={styles.knowledgeSection} aria-labelledby="kb-files-heading">
          <h3 id="kb-files-heading" className={styles.knowledgeSectionTitle}>
            Documents
          </h3>
          <p className={styles.muted} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            Upload PDF, Word (.doc/.docx), plain text, or Markdown. Maximum file size 5&nbsp;MB. After upload, the file
            is queued for extraction and indexing; this list refreshes while processing. When a file is{' '}
            <strong>ready</strong> and <strong>included</strong>, you can open or download the original (links are
            short-lived).
          </p>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1rem' }}
          >
            <label className={styles.label} htmlFor="kb-upload-title" style={{ minWidth: '12rem', marginBottom: 0 }}>
              Title (optional)
            </label>
            <Input
              id="kb-upload-title"
              quiet
              wrapperClassName="min-w-[12rem]"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Defaults to file name"
              disabled={uploading}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              style={{ display: 'none' }}
              onChange={(ev) => void onUploadFileChange(ev)}
            />
            <Button type="button" variant="primary" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? 'Uploading…' : 'Upload document'}
            </Button>
          </div>
          {uploadMsg?.type === 'ok' ? <p className={styles.success}>{uploadMsg.text}</p> : null}
          {uploadMsg?.type === 'err' ? <p className={styles.err}>{uploadMsg.text}</p> : null}
          {counts && typeof counts === 'object' ? (
            <p className={styles.muted} style={{ fontSize: '0.8125rem' }}>
              Queue: {String(counts.queued ?? 0)} · Processing: {String(counts.processing ?? 0)} · Ready:{' '}
              {String(counts.ready ?? 0)} · Failed: {String(counts.failed ?? 0)}
            </p>
          ) : null}
          {docErr ? <p className={styles.err}>{docErr}</p> : null}
          {fileAccessErr ? <p className={styles.err}>{fileAccessErr}</p> : null}
          {docLoading ? (
            <p className={styles.muted}>Loading documents…</p>
          ) : rows.length === 0 ? (
            <p className={styles.knowledgeEmpty} role="status">
              No documents yet. Upload a file to index it, or add a text snippet / Q&amp;A on the other tabs—those live
              on the assistant separately from uploads.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Title / file</th>
                    <th>Status</th>
                    <th>Included</th>
                    <th>Open / download</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const documentId = docId(row);
                    const title = String(row.title ?? row.fileName ?? 'Untitled');
                    const st = String(row.status ?? '');
                    const active = row.active !== false;
                    const canTryFile = rowMayHaveDownloadableFile(row);
                    const busy = fileAccessLoadingId === documentId;
                    let fileHint = '';
                    if (!canTryFile) {
                      const low = st.toLowerCase();
                      if (low === 'queued' || low === 'processing') {
                        fileHint = 'Available when processing finishes.';
                      } else if (low === 'failed') {
                        fileHint = 'Processing failed — fix or re-upload the file.';
                      } else if (!active) {
                        fileHint = 'Turn “Included” on to open or download.';
                      } else if (low !== 'ready') {
                        fileHint = 'Not available for this status.';
                      }
                    }
                    return (
                      <tr key={documentId || title}>
                        <td>
                          <div>{title}</div>
                          {row.fileName ? (
                            <div className={styles.mono} style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                              {String(row.fileName)}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${statusBadgeClass(st)}`}>{st || 'unknown'}</span>
                        </td>
                        <td>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void toggleDocActive(documentId, !active)}
                          >
                            {active ? 'Included' : 'Excluded'}
                          </Button>
                        </td>
                        <td>
                          {canTryFile ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => void openOrDownloadDocumentFile(documentId, 'open')}
                              >
                                {busy ? '…' : 'Open'}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => void openOrDownloadDocumentFile(documentId, 'download')}
                              >
                                {busy ? '…' : 'Download'}
                              </Button>
                            </div>
                          ) : (
                            <span className={styles.muted} style={{ fontSize: '0.75rem' }}>
                              {fileHint}
                            </span>
                          )}
                        </td>
                        <td>
                          {pendingDelete === documentId ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <Button type="button" variant="ghost" className={dangerLinkBtn} onClick={() => void removeDoc(documentId)}>
                                Confirm delete
                              </Button>
                              <Button type="button" variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <Button type="button" variant="ghost" className={dangerLinkBtn} onClick={() => setPendingDelete(documentId)}>
                              Delete
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > rows.length ? (
            <p className={styles.muted} style={{ fontSize: '0.8125rem', marginTop: '0.75rem' }}>
              Showing {rows.length} of {total} documents. Pagination can be expanded in a later release.
            </p>
          ) : null}
        </section>
      ) : null}

      {knowledgeTab === 'text' ? (
        <section className={styles.knowledgeSection} aria-labelledby="kb-text-heading">
          <h3 id="kb-text-heading" className={styles.knowledgeSectionTitle}>
            Text snippet
          </h3>
          <p className={styles.muted} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            Optional plain-language context the model can draw from. Saved with your assistant record.
          </p>
          <form onSubmit={(e) => void saveTextKnowledge(e)}>
            {kbMsg?.type === 'ok' ? <p className={styles.success}>{kbMsg.text}</p> : null}
            {kbMsg?.type === 'err' ? <p className={styles.err}>{kbMsg.text}</p> : null}
            <label className={styles.label} htmlFor="kb-text-snippet">
              Text snippet
            </label>
            <Textarea id="kb-text-snippet" quiet rows={6} value={snippet} onChange={(e) => setSnippet(e.target.value)} />
            <Button type="submit" variant="primary" size="sm" disabled={kbSaving}>
              {kbSaving ? 'Saving…' : 'Save text snippet'}
            </Button>
          </form>
        </section>
      ) : null}

      {knowledgeTab === 'qa' ? (
        <section className={styles.knowledgeSection} aria-labelledby="kb-qa-heading">
          <h3 id="kb-qa-heading" className={styles.knowledgeSectionTitle}>
            Question &amp; answer pairs
          </h3>
          <p className={styles.muted} style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            Curated FAQs stored on the assistant. Both fields are required for a pair to be saved.
          </p>
          <form onSubmit={(e) => void saveTextKnowledge(e)}>
            {kbMsg?.type === 'ok' ? <p className={styles.success}>{kbMsg.text}</p> : null}
            {kbMsg?.type === 'err' ? <p className={styles.err}>{kbMsg.text}</p> : null}
            <div style={{ marginBottom: '0.75rem' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setFaqs((f) => [...f, { question: '', answer: '' }])}>
                Add FAQ pair
              </Button>
            </div>
            {faqs.map((row, i) => (
              <div key={i} className={styles.faqRow}>
                <label className={styles.label} htmlFor={`kb-faq-q-${i}`}>
                  Question
                </label>
                <Input
                  id={`kb-faq-q-${i}`}
                  quiet
                  value={row.question}
                  onChange={(e) =>
                    setFaqs((prev) => prev.map((r, j) => (j === i ? { ...r, question: e.target.value } : r)))
                  }
                />
                <label className={styles.label} htmlFor={`kb-faq-a-${i}`}>
                  Answer
                </label>
                <Textarea
                  id={`kb-faq-a-${i}`}
                  quiet
                  rows={2}
                  value={row.answer}
                  onChange={(e) =>
                    setFaqs((prev) => prev.map((r, j) => (j === i ? { ...r, answer: e.target.value } : r)))
                  }
                />
                {faqs.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={dangerLinkBtn}
                    onClick={() => setFaqs((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove pair
                  </Button>
                ) : null}
              </div>
            ))}
            <Button type="submit" variant="primary" size="sm" disabled={kbSaving}>
              {kbSaving ? 'Saving…' : 'Save Q&A'}
            </Button>
          </form>
        </section>
      ) : null}
    </DataPageLayout>
  );
}
