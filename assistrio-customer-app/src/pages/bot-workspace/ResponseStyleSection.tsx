import { useCallback, useState } from 'react';
import { Loader2, Lock, RefreshCw, Sparkles } from 'lucide-react';
import { refineCustomerBotResponseStyle, type RefineResponseStyleResult } from '../../api/customerApi';
import { Button, Modal, Switch, Textarea } from '@/components/ui';
import { BOT_FIELD_MAX } from '@/lib/botFieldLimits';
import { cn } from '@/lib/utils';
import {
  normalizeResponseStyleDescription,
  normalizeResponseStyleInstructions,
} from './aiIntegrationsConstants';
import { ws } from './workspace';

type Props = {
  botId: string;
  enabled: boolean;
  description: string;
  instructions: string;
  onEnabledChange: (enabled: boolean) => void;
  onRefined: (result: RefineResponseStyleResult) => void;
  onTurnOff: () => void;
  markDirty: () => void;
};

export function ResponseStyleSection({
  botId,
  enabled,
  description,
  instructions,
  onEnabledChange,
  onRefined,
  onTurnOff,
  markDirty,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDescription, setModalDescription] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const hasRefinement = Boolean(normalizeResponseStyleInstructions(instructions));

  const openDescribeModal = useCallback(() => {
    setModalDescription(description);
    setRefineError(null);
    setModalOpen(true);
  }, [description]);

  const runRefine = useCallback(async () => {
    const desc = normalizeResponseStyleDescription(modalDescription);
    if (!desc) {
      setRefineError('Describe the format you want.');
      return;
    }
    setRefining(true);
    setRefineError(null);
    const res = await refineCustomerBotResponseStyle(botId, desc);
    setRefining(false);
    if (!res.ok) {
      setRefineError(res.error);
      return;
    }
    onRefined(res.data);
    markDirty();
    setModalOpen(false);
  }, [botId, modalDescription, markDirty, onRefined]);

  return (
    <section className="mt-8 border-t border-slate-100 pt-6" data-testid="response-format-section">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="min-w-0 flex-1">
          <span id="structured-response-format-label" className={ws.workspaceEditorControlLabel}>
            Use structured response format
          </span>
          <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
            Create a locked reply format for the assistant. When turned off, the assistant replies naturally.
          </p>
        </div>
        <Switch
          id="structured-response-format-toggle"
          checked={enabled}
          data-testid="structured-response-format-toggle"
          onCheckedChange={(v) => {
            if (!v) {
              onTurnOff();
            } else {
              onEnabledChange(true);
            }
            markDirty();
          }}
          aria-labelledby="structured-response-format-label"
          className="mt-0.5 shrink-0"
        />
      </div>

      {!enabled ? (
        <p
          className={cn(ws.workspaceEditorControlHint, 'mt-3')}
          data-testid="response-format-off-hint"
        >
          Structured formatting is off. The assistant will reply naturally based on the user question
          and your AI settings.
        </p>
      ) : (
        <div className="mt-4 space-y-4" data-testid="response-format-on-panel">
          {!hasRefinement ? (
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Structured response format</p>
              <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
                Describe the format you want. Assistrio will convert it into a reliable locked
                instruction.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3 gap-1.5"
                data-testid="describe-response-format-btn"
                onClick={openDescribeModal}
              >
                <Sparkles size={14} aria-hidden />
                Describe response format
              </Button>
            </div>
          ) : (
            <div
              className="rounded-xl border border-teal-200/80 bg-teal-50/30 px-4 py-4"
              data-testid="refined-response-format-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Refined response format</p>
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-teal-600/40 bg-white px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-teal-800"
                  data-testid="response-format-locked-badge"
                >
                  <Lock size={10} aria-hidden />
                  Locked
                </span>
              </div>
              <pre
                className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 font-sans text-[0.8125rem] leading-relaxed text-slate-800"
                data-testid="response-format-locked-instructions"
                aria-readonly="true"
              >
                {instructions}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="edit-response-format-description-btn"
                  onClick={openDescribeModal}
                >
                  Edit description
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  data-testid="regenerate-response-format-btn"
                  onClick={openDescribeModal}
                >
                  <RefreshCw size={14} aria-hidden />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!refining) setModalOpen(false);
        }}
        title="Describe response format"
        description="We will convert your description into a reliable locked format for the assistant."
        size="lg"
        bodyClassName="overflow-hidden"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={refining}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={refining}
              className="gap-1.5"
              data-testid="submit-response-format-refine-btn"
              onClick={() => void runRefine()}
            >
              {refining ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
              {refining ? 'Refining…' : 'Refine format'}
            </Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <div className="flex justify-end">
            <span
              className="text-xs text-slate-500 tabular-nums"
              aria-live="polite"
              data-testid="response-format-description-char-count"
            >
              {`${modalDescription.length}/${BOT_FIELD_MAX.responseStyleDescription}`}
            </span>
          </div>
          <Textarea
            quiet
            rows={5}
            className="min-h-[7.5rem] max-h-[min(45vh,18rem)] resize-none overflow-y-auto"
            value={modalDescription}
            maxLength={BOT_FIELD_MAX.responseStyleDescription}
            placeholder="Example: Always reply with a short title, then the answer below it."
            data-testid="response-format-description-textarea"
            onChange={(e) =>
              setModalDescription(e.target.value.slice(0, BOT_FIELD_MAX.responseStyleDescription))
            }
          />
        </div>
        {refineError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {refineError}
          </p>
        ) : null}
      </Modal>
    </section>
  );
}
