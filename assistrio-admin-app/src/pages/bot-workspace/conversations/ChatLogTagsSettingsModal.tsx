import { useEffect, useId, useState } from 'react';
import { Info } from 'lucide-react';
import type { ChatLogTagPreferenceKey, ChatLogTagPreferences } from './insightsChatLogTagPreferences';
import { Button, Modal, Switch, Tooltip } from '@/components/ui';

const TAG_OPTIONS: { key: ChatLogTagPreferenceKey; label: string; hint: string }[] = [
  {
    key: 'lead',
    label: 'Lead',
    hint: 'Shows when this chat captured a lead.',
  },
  {
    key: 'primaryTopic',
    label: 'Primary topic',
    hint: 'Shows this chat’s primary analytics topic.',
  },
  {
    key: 'allTopics',
    label: 'All topics',
    hint: 'Shows every topic (and subtopic) label Analytics attached to this thread. When on, hides the redundant primary-only chip.',
  },
  {
    key: 'sentiment',
    label: 'Sentiment',
    hint: 'Shows thread-level sentiment when analytics has classified it.',
  },
  {
    key: 'totalUsage',
    label: 'Total usage',
    hint: 'Shows total AI credits used on this chat (from chat logs).',
  },
  {
    key: 'messagesCount',
    label: 'Messages count',
    hint: 'Shows how many messages are in this thread (assistant + visitor).',
  },
  {
    key: 'attachments',
    label: 'Attachments',
    hint: 'Shows attachment activity when visitors sent files in this chat.',
  },
  {
    key: 'widgetChannel',
    label: 'Widget Channel',
    hint:
      'Shows where this chat started (runtime embed, iframe, playground, shared link, and similar origins).',
  },
  {
    key: 'locationCountry',
    label: 'Location — country',
    hint: 'Shows visitor country when available from the session (masked / coarse location).',
  },
  {
    key: 'deviceType',
    label: 'Device type',
    hint: 'Shows device category when analytics recorded it for this visitor session.',
  },
];

type PrefCellProps = {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
};

function PrefCell({ id, label, hint, checked, onCheckedChange }: PrefCellProps) {
  return (
    <div className="flex min-h-[3rem] min-w-0 items-center justify-between gap-2 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-0.5">
        <label htmlFor={id} className="m-0 min-w-0 cursor-pointer truncate text-sm font-medium text-slate-900">
          {label}
        </label>
        <Tooltip content={hint} side="top" panelClassName="max-w-[18rem] text-xs leading-snug">
          <button
            type="button"
            className="-m-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600/45"
            aria-label={`About ${label}`}
          >
            <Info className="size-[15px]" strokeWidth={2} aria-hidden />
          </button>
        </Tooltip>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={`Show ${label} on chat log rows`}
        className="shrink-0"
      />
    </div>
  );
}

export type ChatLogTagsSettingsModalProps = {
  open: boolean;
  onClose: () => void;
  preferences: ChatLogTagPreferences;
  onSave: (next: ChatLogTagPreferences) => void;
};

export function ChatLogTagsSettingsModal({ open, onClose, preferences, onSave }: ChatLogTagsSettingsModalProps) {
  const baseId = useId();
  const [draft, setDraft] = useState<ChatLogTagPreferences>(preferences);

  useEffect(() => {
    if (open) setDraft(preferences);
  }, [open, preferences]);

  const pid = (s: string) => `${baseId}-${s}`;
  const setKey = (key: ChatLogTagPreferenceKey, v: boolean) => setDraft((d) => ({ ...d, [key]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chat log tags"
      description="Choose which chips appear on each chat row in Chat logs. Rows only show a tag when that data exists."
      size="lg"
      className="max-w-xl"
      closeOnBackdropClick
      bodyClassName="min-h-0 px-4 py-2 sm:px-5 sm:py-3"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-y-px sm:grid-cols-2 sm:gap-x-6">
        {TAG_OPTIONS.map((opt) => (
          <PrefCell
            key={opt.key}
            id={pid(opt.key)}
            label={opt.label}
            hint={opt.hint}
            checked={draft[opt.key]}
            onCheckedChange={(v) => setKey(opt.key, v)}
          />
        ))}
      </div>
    </Modal>
  );
}
