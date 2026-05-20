import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Modal,
  Range,
  RangeMinMax,
  SearchableMultiSelect,
  SearchableSelect,
  Select,
  type SearchableMultiSelectOption,
  type SearchableSelectOption,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  AdminChatsAnalyticsStartedFromKey,
  AdminTopicsAnalyticsTopicId,
  AdminSentimentLabelId,
} from '@/api/types';
import { ADMIN_TOPICS_ANALYTICS_MAIN_TOPIC_IDS } from '@/api/types';
import { customYmdRangeIsValid } from '@/lib/analyticsQueryDates';
import {
  ANALYTICS_DATE_PRESET_OPTIONS,
  seedCustomRangeIfEmpty,
} from '@/pages/bot-workspace/analytics/shared/analyticsFilterCapsuleUtils';
import { WIDGET_CHANNEL_SECTIONS } from '@/pages/bot-workspace/analytics/shared/widgetChannelLabels';
import { SENTIMENT_DISPLAY_FALLBACK, SENTIMENT_STACK_ORDER } from '@/pages/bot-workspace/analytics/sentiment/sentimentChartTheme';
import { TOPIC_DISPLAY_FALLBACK } from '@/pages/bot-workspace/analytics/topics/topicTaxonomy';
import { getLeadsFilterCountryOptions } from '@/pages/bot-workspace/leads/leadsFilterCountryOptions';
import type {
  ConversationFiltersDraft,
  ConversationDatePreset,
  DeviceFilterValue,
  TriState,
} from './conversationFiltersModel';
import {
  defaultConversationFiltersDraft,
  sortConversationTaxonomyTopicKeys,
  sortConversationSentimentKeys,
  sortConversationWidgetChannelKeys,
} from './conversationFiltersModel';

/** Upper slider bound (default max knob); sliding there clears the max filter (open-ended). Min defaults to 0. */
const CREDITS_RANGE_SLIDER_MAX = 9_999;

/** Minimum thread messages: slider upper bound (0 = no minimum filter). */
const MESSAGES_RANGE_SLIDER_MAX = 500;

function parseCreditsNum(raw: string): number | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const n = Number.parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function creditsMinSliderValue(creditsMin: string): number {
  return parseCreditsNum(creditsMin) ?? 0;
}

/** Empty max in draft = no upper bound → thumb at this end of the slider. */
function creditsMaxSliderValue(creditsMax: string): number {
  const n = parseCreditsNum(creditsMax);
  if (n !== undefined) return Math.min(n, CREDITS_RANGE_SLIDER_MAX);
  return CREDITS_RANGE_SLIDER_MAX;
}

function messagesMinSliderValue(messagesMin: string): number {
  const n = parseCreditsNum(messagesMin);
  if (n !== undefined) return Math.min(Math.floor(n), MESSAGES_RANGE_SLIDER_MAX);
  return 0;
}

function derivedCreditsSlider(d: ConversationFiltersDraft): { low: number; high: number } {
  const cap = CREDITS_RANGE_SLIDER_MAX;
  switch (d.creditsPreset) {
    case 'all':
      return { low: 0, high: cap };
    case 'zero':
      return { low: 0, high: 0 };
    case 'positive':
      return { low: 1, high: cap };
    case 'custom': {
      const a = creditsMinSliderValue(d.creditsMin);
      const b = creditsMaxSliderValue(d.creditsMax);
      return { low: Math.min(a, b), high: Math.max(a, b) };
    }
    default:
      return { low: 0, high: cap };
  }
}

function applyCreditsRange(d: ConversationFiltersDraft, low: number, high: number): ConversationFiltersDraft {
  const cap = CREDITS_RANGE_SLIDER_MAX;
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  if (lo === 0 && hi === 0) {
    return { ...d, creditsPreset: 'zero', creditsMin: '', creditsMax: '' };
  }
  if (lo === 1 && hi >= cap) {
    return { ...d, creditsPreset: 'positive', creditsMin: '', creditsMax: '' };
  }
  if (lo === 0 && hi >= cap) {
    return { ...d, creditsPreset: 'all', creditsMin: '', creditsMax: '' };
  }
  return {
    ...d,
    creditsPreset: 'custom',
    creditsMin: lo === 0 ? '' : String(lo),
    creditsMax: hi >= cap ? '' : String(hi),
  };
}

/** Matches Select / SearchableSelect compact triggers in this modal. */
const COMPACT_TRIGGER = '!h-7 !min-h-7 !px-2.5 text-xs leading-tight';

/** Right column: fixed max width so labels stay left and controls align. */
const CONTROL_CELL = 'min-w-0 flex-1 basis-[58%] max-w-[209px]';

const CONVERSATION_DEVICE_OPTIONS = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'bot', label: 'Bot' },
  { value: 'unknown', label: 'Unknown' },
];

const TRI_OPTIONS: { id: TriState; label: string }[] = [
  { id: 'all', label: 'Any' },
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
];

const DATE_SELECT_ROWS: Array<{ id: ConversationDatePreset; label: string }> = [
  { id: 'all', label: 'All time' },
  ...ANALYTICS_DATE_PRESET_OPTIONS,
];

function FilterSection({
  sectionId,
  title,
  subtitle,
  children,
}: {
  sectionId: string;
  title: string;
  /** Brief helper under the section heading (sentence case). */
  subtitle?: string;
  children: ReactNode;
}) {
  const subtitleId = subtitle ? `${sectionId}-subtitle` : undefined;
  return (
    <section className="flex flex-col gap-2" aria-labelledby={sectionId} aria-describedby={subtitleId}>
      <div className="px-0.5">
        <h3 id={sectionId} className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        {subtitle ? (
          <p
            id={subtitleId}
            className="m-0 mt-1 font-normal normal-case tracking-normal text-xs leading-snug text-slate-500"
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <Card className="overflow-hidden border-slate-200/90 bg-[var(--ui-surface-muted)] shadow-none">
        <CardBody className="!px-3 !py-2.5 sm:!px-4 sm:!py-3">{children}</CardBody>
      </Card>
    </section>
  );
}

/** Single-line row: label (left) + control (right), matching filter layout. */
function FilterInlineRow({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex min-h-7 items-center justify-between gap-2 sm:gap-3">
        <Label htmlFor={htmlFor} className="mb-0 shrink-0 cursor-default text-xs font-medium text-slate-600">
          {label}
        </Label>
        <div className={CONTROL_CELL}>{children}</div>
      </div>
      {error ? (
        <p className="m-0 text-[0.6875rem] leading-snug text-[var(--color-danger-text-emphasis)]">{error}</p>
      ) : null}
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  initialDraft: ConversationFiltersDraft;
  onApply: (draft: ConversationFiltersDraft) => void;
  onClear: () => void;
};

export function ConversationFilters({ open, onClose, initialDraft, onApply, onClear }: Props) {
  const [draft, setDraft] = useState<ConversationFiltersDraft>(initialDraft);
  const countryOptions = useMemo(() => getLeadsFilterCountryOptions(), []);

  useEffect(() => {
    if (!open) return;
    const next = { ...initialDraft };
    next.startedFromKeys = sortConversationWidgetChannelKeys(initialDraft.startedFromKeys);
    setDraft(next);
  }, [open, initialDraft]);

  const countrySelectOptions = useMemo((): SearchableSelectOption[] => {
    const rows: SearchableSelectOption[] = countryOptions.map((c) => {
      const line = c.name.includes(`(${c.code})`) ? c.name : `${c.name} (${c.code})`;
      return { value: c.code, label: line };
    });
    return [{ value: '', label: 'Any country' }, ...rows];
  }, [countryOptions]);

  const widgetChannelOptions = useMemo((): SearchableMultiSelectOption[] => {
    return WIDGET_CHANNEL_SECTIONS.flatMap((sec) =>
      sec.options.map((opt) => ({ value: opt.id, label: opt.label, group: sec.title })),
    );
  }, []);

  const topicOptions = useMemo((): SearchableMultiSelectOption[] => {
    return ADMIN_TOPICS_ANALYTICS_MAIN_TOPIC_IDS.map((topicId) => ({
      value: topicId,
      label: TOPIC_DISPLAY_FALLBACK[topicId],
    }));
  }, []);

  const sentimentOptions = useMemo((): SearchableMultiSelectOption[] => {
    return SENTIMENT_STACK_ORDER.map((sid) => ({
      value: sid,
      label: SENTIMENT_DISPLAY_FALLBACK[sid],
    }));
  }, []);

  const customInvalid =
    draft.datePreset === 'custom' &&
    draft.customFrom.trim() &&
    draft.customTo.trim() &&
    !customYmdRangeIsValid(draft.customFrom, draft.customTo);

  const creditsRangeInvalid =
    draft.creditsPreset === 'custom' &&
    !!(draft.creditsMin.trim() && draft.creditsMax.trim()) &&
    Number.parseFloat(draft.creditsMin.trim()) > Number.parseFloat(draft.creditsMax.trim());

  const setTri = <K extends keyof ConversationFiltersDraft>(key: K, v: TriState) =>
    setDraft((d) => ({ ...d, [key]: v } as ConversationFiltersDraft));

  const dateError = customInvalid ? 'End date must be on or after start date.' : null;
  const creditsError = creditsRangeInvalid ? 'Maximum must be at least minimum.' : null;

  const creditSlider = derivedCreditsSlider(draft);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chat filters"
      description="Choose criteria to narrow which chats appear in the list."
      titleClassName="text-lg font-bold tracking-tight text-slate-950"
      size="lg"
      bodyClassName="!px-4 !py-3 sm:!px-4"
      footerClassName="!py-2.5"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(defaultConversationFiltersDraft());
              onClear();
              onClose();
            }}
          >
            Reset Filters
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
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
      <div className="flex flex-col gap-5 overflow-x-hidden">
        <FilterSection
          sectionId="conversation-filters-basic"
          title="Basic"
          subtitle="Date, Widget Channel, device, country, messages, credits."
        >
          <div className="flex flex-col divide-y divide-slate-200/80">
            <div className="py-2 first:pt-0">
              <FilterInlineRow label="Date range" htmlFor="conv-date-preset" error={dateError}>
                <Select
                  id="conv-date-preset"
                  value={draft.datePreset}
                  triggerClassName={COMPACT_TRIGGER}
                  onChange={(e) => {
                    const v = e.target.value as ConversationDatePreset;
                    setDraft((d) => {
                      if (v === 'all') return { ...d, datePreset: 'all', customFrom: '', customTo: '' };
                      if (v === 'custom' && !d.customFrom.trim() && !d.customTo.trim())
                        return { ...d, datePreset: 'custom', ...seedCustomRangeIfEmpty() };
                      return { ...d, datePreset: v };
                    });
                  }}
                >
                  {DATE_SELECT_ROWS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FilterInlineRow>
              {draft.datePreset === 'custom' ? (
                <div className="mt-2 border-t border-slate-200/50 pt-2">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex min-w-0 flex-col gap-0">
                      <Label htmlFor="conv-f-from" className="mb-1.5 cursor-default text-xs font-medium text-slate-600">
                        From
                      </Label>
                      <Input
                        id="conv-f-from"
                        type="date"
                        value={draft.customFrom}
                        onChange={(ev) => setDraft((d) => ({ ...d, customFrom: ev.target.value }))}
                        inputSize="sm"
                        quiet
                        wrapperClassName="w-full min-w-0"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0">
                      <Label htmlFor="conv-f-to" className="mb-1.5 cursor-default text-xs font-medium text-slate-600">
                        To
                      </Label>
                      <Input
                        id="conv-f-to"
                        type="date"
                        value={draft.customTo}
                        onChange={(ev) => setDraft((d) => ({ ...d, customTo: ev.target.value }))}
                        inputSize="sm"
                        quiet
                        wrapperClassName="w-full min-w-0"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="py-2">
              <FilterInlineRow label="Widget Channel" htmlFor="conv-widget-channel-ms">
                <SearchableMultiSelect
                  id="conv-widget-channel-ms"
                  value={draft.startedFromKeys}
                  options={widgetChannelOptions}
                  emptyLabel="Any channel"
                  searchPlaceholder="Search channels…"
                  triggerClassName={COMPACT_TRIGGER}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      startedFromKeys: sortConversationWidgetChannelKeys(
                        next as AdminChatsAnalyticsStartedFromKey[],
                      ),
                    }))
                  }
                />
              </FilterInlineRow>
            </div>

            <div className="py-2">
              <FilterInlineRow label="Device type" htmlFor="conv-device">
                <Select
                  id="conv-device"
                  value={draft.deviceType}
                  triggerClassName={COMPACT_TRIGGER}
                  onChange={(e) => setDraft((d) => ({ ...d, deviceType: e.target.value as DeviceFilterValue }))}
                >
                  <option value="">Any device</option>
                  {CONVERSATION_DEVICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FilterInlineRow>
            </div>

            <div className="py-2">
              <FilterInlineRow label="Country" htmlFor="conv-country-ss">
                <SearchableSelect
                  id="conv-country-ss"
                  value={draft.countryCode.trim()}
                  options={countrySelectOptions}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, countryCode: e.target.value.trim().slice(0, 2).toUpperCase() }))
                  }
                  searchPlaceholder="Search countries…"
                  className="w-full"
                  triggerClassName={COMPACT_TRIGGER}
                />
              </FilterInlineRow>
            </div>

            <div className="py-2">
              <FilterInlineRow label="Messages" htmlFor="conv-messages-min-slider">
                <Range
                  id="conv-messages-min"
                  label="Minimum messages in thread"
                  hideLabel
                  variant="trackBadges"
                  formatTrackValue={(v) => `${v.toLocaleString()} msg`}
                  min={0}
                  max={MESSAGES_RANGE_SLIDER_MAX}
                  step={1}
                  value={messagesMinSliderValue(draft.messagesMin)}
                  onValueChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      messagesMin: v <= 0 ? '' : String(Math.min(v, MESSAGES_RANGE_SLIDER_MAX)),
                    }))
                  }
                  className="[&_span.text-sm]:!text-xs"
                />
              </FilterInlineRow>
            </div>

            <div className="py-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex min-h-7 items-center justify-between gap-2 sm:gap-3">
                  <Label
                    htmlFor="conv-credits-mm-low"
                    className="mb-0 shrink-0 cursor-default text-xs font-medium text-slate-600"
                  >
                    Total credit usage
                  </Label>
                  <div className={CONTROL_CELL}>
                    <RangeMinMax
                      id="conv-credits-mm"
                      label="Total credit usage"
                      hideLabel
                      min={0}
                      max={CREDITS_RANGE_SLIDER_MAX}
                      step={1}
                      low={creditSlider.low}
                      high={creditSlider.high}
                      onLowChange={(v) =>
                        setDraft((d) => applyCreditsRange(d, v, derivedCreditsSlider(d).high))
                      }
                      onHighChange={(v) =>
                        setDraft((d) => applyCreditsRange(d, derivedCreditsSlider(d).low, v))
                      }
                      formatLowLabel={(v) => `${v.toLocaleString()}cr`}
                      formatHighLabel={(v) => `${v.toLocaleString()}cr`}
                      className="[&_span.text-sm]:!text-xs"
                    />
                  </div>
                </div>
                {creditsError ? (
                  <p className="m-0 text-[0.6875rem] leading-snug text-[var(--color-danger-text-emphasis)]">
                    {creditsError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </FilterSection>

        <FilterSection
          sectionId="conversation-filters-topic-sentiment"
          title="Topic & sentiment"
          subtitle="Uses thread-level Analytics labels (primary topic, additional topic tags, sentiment)."
        >
          <div className="flex flex-col divide-y divide-slate-200/80">
            <div className="py-2 first:pt-0">
              <FilterInlineRow label="Primary topics" htmlFor="conv-primary-topics-ms">
                <SearchableMultiSelect
                  id="conv-primary-topics-ms"
                  value={draft.primaryTopicKeys}
                  options={topicOptions}
                  emptyLabel="Any topic"
                  searchPlaceholder="Search topics…"
                  triggerClassName={COMPACT_TRIGGER}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      primaryTopicKeys: sortConversationTaxonomyTopicKeys(
                        next as AdminTopicsAnalyticsTopicId[],
                      ),
                    }))
                  }
                />
              </FilterInlineRow>
            </div>

            <div className="py-2">
              <FilterInlineRow label="Other topics" htmlFor="conv-secondary-topics-ms">
                <SearchableMultiSelect
                  id="conv-secondary-topics-ms"
                  value={draft.secondaryTopicKeys}
                  options={topicOptions}
                  emptyLabel="Any topic"
                  searchPlaceholder="Search topics…"
                  triggerClassName={COMPACT_TRIGGER}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      secondaryTopicKeys: sortConversationTaxonomyTopicKeys(
                        next as AdminTopicsAnalyticsTopicId[],
                      ),
                    }))
                  }
                />
              </FilterInlineRow>
            </div>

            <div className="py-2">
              <FilterInlineRow label="Sentiment" htmlFor="conv-sentiment-ms">
                <SearchableMultiSelect
                  id="conv-sentiment-ms"
                  value={draft.sentimentKeys}
                  options={sentimentOptions}
                  emptyLabel="Any sentiment"
                  searchPlaceholder="Search sentiment…"
                  triggerClassName={COMPACT_TRIGGER}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      sentimentKeys: sortConversationSentimentKeys(next as AdminSentimentLabelId[]),
                    }))
                  }
                />
              </FilterInlineRow>
            </div>
          </div>
        </FilterSection>

        <FilterSection
          sectionId="conversation-filters-traits"
          title="Chat traits"
          subtitle="Require or exclude chats with leads, voice, sessions, or file attachments."
        >
          <div className="flex flex-col divide-y divide-slate-200/80">
            {(
              [
                ['Lead captured', 'hasLead'],
                ['Voice messages', 'hasVoice'],
                ['Sessions', 'hasDictation'],
                ['File attachments', 'hasAttachment'],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="py-2 first:pt-0">
                <FilterInlineRow label={label} htmlFor={`conv-trait-${key}`}>
                  <Select
                    id={`conv-trait-${key}`}
                    value={draft[key]}
                    triggerClassName={COMPACT_TRIGGER}
                    onChange={(e) => setTri(key, e.target.value as TriState)}
                  >
                    {TRI_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FilterInlineRow>
              </div>
            ))}
          </div>
        </FilterSection>
      </div>
    </Modal>
  );
}
