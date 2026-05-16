import { useEffect, useState } from 'react';
import { Button, Input, Label, Modal, Select } from '@/components/ui';
import type { ConversationFiltersDraft, TriState } from './conversationFiltersModel';
import { defaultConversationFiltersDraft } from './conversationFiltersModel';

type Props = {
  open: boolean;
  onClose: () => void;
  initialDraft: ConversationFiltersDraft;
  onApply: (draft: ConversationFiltersDraft) => void;
  onClear: () => void;
};

function TriSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-slate-600">
        {label}
      </Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as TriState)} quiet triggerClassName="h-9">
        <option value="all">All</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>
    </div>
  );
}

export function ConversationFilters({ open, onClose, initialDraft, onApply, onClear }: Props) {
  const [draft, setDraft] = useState<ConversationFiltersDraft>(initialDraft);

  useEffect(() => {
    if (open) setDraft(initialDraft);
  }, [open, initialDraft]);

  const setCountry = (raw: string) => {
    const u = raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    setDraft((d) => ({ ...d, countryCode: u }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conversation filters"
      description="Narrow chat logs by date, channel, device, and flags. Applying reloads the list from the top."
      size="lg"
      closeOnBackdropClick
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              setDraft(defaultConversationFiltersDraft());
              onClear();
              onClose();
            }}
          >
            Clear filters
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Apply filters
          </Button>
        </div>
      }
    >
      <div className="max-h-[min(70vh,28rem)] min-h-0 overflow-y-auto overflow-x-hidden pr-0.5 [-webkit-overflow-scrolling:touch]">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="conv-filter-from" className="text-xs font-semibold text-slate-600">
            From date
          </Label>
          <Input
            id="conv-filter-from"
            type="date"
            value={draft.dateFrom}
            onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
            quiet
            inputSize="md"
          />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="conv-filter-to" className="text-xs font-semibold text-slate-600">
            To date
          </Label>
          <Input
            id="conv-filter-to"
            type="date"
            value={draft.dateTo}
            onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
            quiet
            inputSize="md"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="conv-filter-started" className="text-xs font-semibold text-slate-600">
            Started from
          </Label>
          <Select
            id="conv-filter-started"
            value={draft.startedFrom}
            onChange={(e) =>
              setDraft((d) => ({ ...d, startedFrom: e.target.value as ConversationFiltersDraft['startedFrom'] }))
            }
            quiet
            triggerClassName="h-9"
          >
            <option value="">All</option>
            <option value="playground_preview">Playground Preview</option>
            <option value="shared_preview">Shared Preview</option>
            <option value="runtime_widget">Runtime Widget</option>
            <option value="runtime_iframe">Runtime IFrame</option>
            <option value="unknown">Unknown</option>
          </Select>
        </div>
        <TriSelect
          id="conv-filter-lead"
          label="Has lead"
          value={draft.hasLead}
          onChange={(v) => setDraft((d) => ({ ...d, hasLead: v }))}
        />
        <TriSelect
          id="conv-filter-voice"
          label="Has voice"
          value={draft.hasVoice}
          onChange={(v) => setDraft((d) => ({ ...d, hasVoice: v }))}
        />
        <TriSelect
          id="conv-filter-dict"
          label="Has dictation"
          value={draft.hasDictation}
          onChange={(v) => setDraft((d) => ({ ...d, hasDictation: v }))}
        />
        <TriSelect
          id="conv-filter-attach"
          label="Has attachment"
          value={draft.hasAttachment}
          onChange={(v) => setDraft((d) => ({ ...d, hasAttachment: v }))}
        />
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="conv-filter-device" className="text-xs font-semibold text-slate-600">
            Device type
          </Label>
          <Select
            id="conv-filter-device"
            value={draft.deviceType}
            onChange={(e) =>
              setDraft((d) => ({ ...d, deviceType: e.target.value as ConversationFiltersDraft['deviceType'] }))
            }
            quiet
            triggerClassName="h-9"
          >
            <option value="">All</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
            <option value="bot">Bot</option>
            <option value="unknown">Unknown</option>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="conv-filter-cc" className="text-xs font-semibold text-slate-600">
            Country code
          </Label>
          <Input
            id="conv-filter-cc"
            value={draft.countryCode}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. US"
            maxLength={2}
            autoCapitalize="characters"
            spellCheck={false}
            quiet
            inputSize="md"
            className="font-mono uppercase"
          />
        </div>
      </div>
      </div>
    </Modal>
  );
}
