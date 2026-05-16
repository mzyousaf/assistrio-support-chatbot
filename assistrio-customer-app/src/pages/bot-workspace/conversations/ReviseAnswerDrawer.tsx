import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, type TransitionEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { FaqFullFromMessageForm } from './FaqFullFromMessageForm';
import { SnippetFromMessageForm } from './SnippetFromMessageForm';

const REVIEW_ANSWER_PANEL_INFO =
  'Turn this assistant reply into reusable knowledge: refine it as Q&A or as a snippet and save. Future chats can draw on it once training completes.';

const QA_FORM_ID = 'revise-answer-qa-form';
const SNIPPET_FORM_ID = 'revise-answer-snippet-form';

const DRAWER_TRANSITION_MS = 280;

export type ReviseAnswerDrawerProps = {
  open: boolean;
  onClose: () => void;
  botId: string;
  initialQuestion: string;
  initialAnswer: string;
  /** Seeds Q&A title (same UTF‑8 cap as Knowledge → Q&A editor). */
  initialQaTitle: string;
  /** Seeds snippet title (e.g. derived from answer preview). */
  initialSnippetTitle: string;
};

type Mode = 'qa' | 'snippet';

export function ReviseAnswerDrawer({
  open,
  onClose,
  botId,
  initialQuestion,
  initialAnswer,
  initialQaTitle,
  initialSnippetTitle,
}: ReviseAnswerDrawerProps) {
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  /** Keeps the portal mounted until the close animation finishes. */
  const [present, setPresent] = useState(open);
  /** Drives opacity/transform toward the open visual state. */
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<Mode>('qa');
  const [qaBusy, setQaBusy] = useState(false);
  const [snippetBusy, setSnippetBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(id);
    }
    setEntered(false);
  }, [open]);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [present]);

  /** If transitionend does not fire (reduced motion, browser quirks), still unmount the portal. */
  useEffect(() => {
    if (open || !present) return;
    const ms = DRAWER_TRANSITION_MS + 60;
    const t = window.setTimeout(() => setPresent(false), ms);
    return () => window.clearTimeout(t);
  }, [open, present]);

  useEffect(() => {
    if (!open) return;
    setMode('qa');
    setQaBusy(false);
    setSnippetBusy(false);
  }, [open, initialQuestion, initialAnswer, initialQaTitle, initialSnippetTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !qaBusy && !snippetBusy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, qaBusy, snippetBusy]);

  function onPanelTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== 'transform') return;
    if (!open) setPresent(false);
  }

  if (!present) return null;

  const busy = mode === 'qa' ? qaBusy : snippetBusy;
  const activeFormId = mode === 'qa' ? QA_FORM_ID : SNIPPET_FORM_ID;

  const panel = (
    <div className="fixed inset-0 z-[300]" role="presentation">
      <button
        type="button"
        tabIndex={-1}
        className={cn(
          'absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[1px] transition-opacity ease-out motion-reduce:transition-none',
          entered ? 'opacity-100' : 'opacity-0 motion-reduce:opacity-100',
        )}
        style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms` }}
        aria-label="Close panel"
        disabled={busy}
        onClick={() => !busy && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        onTransitionEnd={onPanelTransitionEnd}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200/90 bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)]',
          'transform-gpu transition-transform motion-reduce:transition-none',
          entered ? 'translate-x-0 ease-out' : 'translate-x-full ease-in motion-reduce:translate-x-0',
        )}
        style={{ transitionDuration: `${DRAWER_TRANSITION_MS}ms` }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-base font-semibold text-slate-900">
              Review Answer
            </h2>
            <p id={subtitleId} className="m-0 mt-0.5 text-xs leading-snug text-slate-500">
              {REVIEW_ANSWER_PANEL_INFO}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            disabled={busy}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-slate-100 px-4 pt-2">
          <button
            type="button"
            className={cn(
              'rounded-t-md border border-b-0 px-3 py-2 text-xs font-semibold transition',
              mode === 'qa'
                ? 'border-slate-200 bg-white text-teal-800'
                : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700',
            )}
            onClick={() => setMode('qa')}
            disabled={busy}
          >
            Q&amp;A
          </button>
          <button
            type="button"
            className={cn(
              'rounded-t-md border border-b-0 px-3 py-2 text-xs font-semibold transition',
              mode === 'snippet'
                ? 'border-slate-200 bg-white text-teal-800'
                : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700',
            )}
            onClick={() => setMode('snippet')}
            disabled={busy}
          >
            Snippet
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div hidden={mode !== 'qa'}>
            <FaqFullFromMessageForm
              botId={botId}
              formId={QA_FORM_ID}
              initialTitle={initialQaTitle}
              seedQuestion={initialQuestion}
              initialAnswer={initialAnswer}
              onSaved={onClose}
              onBusyChange={setQaBusy}
            />
          </div>
          <div hidden={mode !== 'snippet'}>
            <SnippetFromMessageForm
              botId={botId}
              formId={SNIPPET_FORM_ID}
              initialTitle={initialSnippetTitle}
              initialContent={initialAnswer}
              onSaved={onClose}
              onBusyChange={setSnippetBusy}
            />
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={busy} form={activeFormId}>
            {busy ? (
              <>
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
