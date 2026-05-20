import type { CustomerConversationListItem, CustomerConversationTopicsSummary } from '@/api/types';
import {
  ContactRound,
  Globe,
  Layers,
  MessageSquare,
  Paperclip,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { Tooltip } from '@/components/ui';
import {
  capitalizeWordsFromKey,
  conversationChannelPresentation,
  INSIGHT_EM_DASH,
} from './conversationInsightsFormatting';
import { MESSAGE_SENTIMENT_TAG_LABELS, chatLogListChipClass } from './conversationTopicSentimentDisplay';
import type { ChatLogTagPreferences } from './insightsChatLogTagPreferences';
import { MessageCreditBadge } from './MessageCreditBadge';
import { SentimentTag, TopicTag } from './MessageTopicSentimentTags';

type Props = {
  conversation: CustomerConversationListItem;
  active: boolean;
  onSelect: (id: string) => void;
  tagVisibility: ChatLogTagPreferences;
};

/** Matches conversation rollup: explicit primary or first taxonomy id in labels. */
function primaryTopicId(topics: CustomerConversationTopicsSummary | undefined): string {
  if (!topics) return '';
  const primary = topics.primaryTopic?.trim() ?? '';
  if (primary) return primary;
  for (const x of topics.topicLabels ?? []) {
    const id = typeof x === 'string' ? x.trim() : '';
    if (id) return id;
  }
  return '';
}

/** Deduped Analytics topic/subtopic ids in display order for chat-log chips. */
function uniqueOrderedTopicChipIds(topics: CustomerConversationTopicsSummary | undefined): string[] {
  if (!topics) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string | undefined | null) => {
    const t = (typeof id === 'string' ? id : '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  push(topics.primaryTopic);
  for (const x of topics.topicLabels ?? []) push(typeof x === 'string' ? x : '');
  push(topics.primarySubTopic);
  for (const x of topics.subTopicLabels ?? []) push(typeof x === 'string' ? x : '');
  return out;
}

function locationCountryChipText(c: CustomerConversationListItem): string {
  const loc = c.location;
  const name = (loc?.country ?? '').trim();
  const code = (loc?.countryCode ?? '').trim().toUpperCase();
  if (name) return name;
  if (code) return code;
  return '';
}

function deviceTypeChipText(c: CustomerConversationListItem): string {
  const raw = (c.deviceInfo?.deviceType ?? '').trim();
  if (!raw) return '';
  return capitalizeWordsFromKey(raw.replace(/_/g, ' '));
}

export function ConversationListItem({ conversation: c, active, onSelect, tagVisibility }: Props) {
  const main = (c.assistantPreview || '').trim() || (c.userPreview || '').trim() || '—';
  const secondary = (c.userPreview || '').trim();
  const abs = formatConversationAbsolute(c.lastActivityAt);
  const rel = formatConversationRelative(c.lastActivityAt);
  const primaryId = primaryTopicId(c.conversationTopics);
  const allTopicChipIds = uniqueOrderedTopicChipIds(c.conversationTopics);
  const sk = c.conversationSentiment?.label?.trim().toLowerCase() ?? '';
  const showSentiment = Boolean(sk && MESSAGE_SENTIMENT_TAG_LABELS.has(sk));
  const credits = typeof c.totalCreditsUsed === 'number' && Number.isFinite(c.totalCreditsUsed) ? c.totalCreditsUsed : 0;

  const totalMsgs =
    typeof c.totalMessages === 'number' && Number.isFinite(c.totalMessages) ? Math.round(c.totalMessages) : 0;

  const attachmentCountRaw =
    typeof c.attachmentMessageCount === 'number' && Number.isFinite(c.attachmentMessageCount)
      ? Math.round(c.attachmentMessageCount)
      : 0;

  const channelLabel = conversationChannelPresentation({
    startedFrom: c.startedFrom,
    sessionSource: c.sessionSource,
  });
  const countryText = locationCountryChipText(c);
  const deviceText = deviceTypeChipText(c);

  const showLeadChip = tagVisibility.lead && c.hasLead;
  const showAllTopicChips = tagVisibility.allTopics && allTopicChipIds.length > 0;
  const showPrimaryTopicOnlyChip = tagVisibility.primaryTopic && !tagVisibility.allTopics && Boolean(primaryId);
  const showSentChip = tagVisibility.sentiment && showSentiment && sk;
  const showUsageChip = tagVisibility.totalUsage;
  const showMessagesChip = tagVisibility.messagesCount && totalMsgs > 0;
  const showAttachmentsChip =
    tagVisibility.attachments && (attachmentCountRaw > 0 || Boolean(c.hasAttachment));
  const showChannelChip = tagVisibility.widgetChannel && channelLabel !== INSIGHT_EM_DASH;
  const showCountryChip = tagVisibility.locationCountry && Boolean(countryText);
  const showDeviceChip = tagVisibility.deviceType && Boolean(deviceText);

  const showTagStrip =
    showLeadChip ||
    showPrimaryTopicOnlyChip ||
    showAllTopicChips ||
    showSentChip ||
    showUsageChip ||
    showMessagesChip ||
    showAttachmentsChip ||
    showChannelChip ||
    showCountryChip ||
    showDeviceChip;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(c.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(c.id);
        }
      }}
      className={cn(
        'mb-1.5 w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        active
          ? 'border-teal-500 bg-teal-50/50 shadow-sm ring-1 ring-teal-500/15'
          : 'border border-slate-200/90 bg-white hover:border-teal-300/85 hover:bg-teal-50/55',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="m-0 min-w-0 flex-1 line-clamp-2 font-medium leading-snug text-slate-900">{main}</p>
        <Tooltip content={abs} side="top" panelClassName="max-w-xs text-xs">
          <span className="shrink-0 cursor-default text-right text-[11px] font-medium tabular-nums text-slate-500">
            {rel}
          </span>
        </Tooltip>
      </div>
      {secondary ? (
        <p className="mt-1 line-clamp-1 text-xs leading-snug text-slate-600">{secondary}</p>
      ) : (
        <p className="mt-1 text-xs italic text-slate-400">No user message preview</p>
      )}
      {showTagStrip ? (
        <div
          className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1"
          role="group"
          aria-label="Chat tags"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {showLeadChip ? (
            <span className={cn(chatLogListChipClass, 'cursor-default')} title="Captured lead">
              <ContactRound className="size-3 shrink-0 text-teal-600" strokeWidth={2} aria-hidden />
              Lead
            </span>
          ) : null}
          {showPrimaryTopicOnlyChip ?
            <TopicTag topicId={primaryId} chatLogList className="max-w-[12rem]" />
          : null}
          {showAllTopicChips ?
            allTopicChipIds.map((topicId) => (
              <TopicTag key={topicId} topicId={topicId} chatLogList className="max-w-[12rem]" />
            ))
          : null}
          {showSentChip ? <SentimentTag labelKey={sk} chatLogList /> : null}
          {showUsageChip ? <MessageCreditBadge creditCost={credits} chatLogList /> : null}
          {showMessagesChip ?
            <span className={cn(chatLogListChipClass, 'cursor-default')} title={`Total messages: ${totalMsgs}`}>
              <MessageSquare className="size-3 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
              <span className="tabular-nums">{totalMsgs}</span>
            </span>
          : null}
          {showAttachmentsChip ?
            <span
              className={cn(chatLogListChipClass, 'cursor-default')}
              title={attachmentCountRaw ? `${attachmentCountRaw} attachment message(s)` : 'Attachments'}
            >
              <Paperclip className="size-3 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
              {attachmentCountRaw > 0 ? <span className="tabular-nums">{attachmentCountRaw}</span> : <span>·</span>}
            </span>
          : null}
          {showChannelChip ?
            <span className={cn(chatLogListChipClass, 'cursor-default max-w-[13rem]', 'truncate')} title={channelLabel}>
              <Layers className="size-3 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
              <span className="min-w-0 truncate">{channelLabel}</span>
            </span>
          : null}
          {showCountryChip ?
            <span className={cn(chatLogListChipClass, 'cursor-default max-w-[12rem]', 'truncate')} title={countryText}>
              <Globe className="size-3 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
              <span className="min-w-0 truncate">{countryText}</span>
            </span>
          : null}
          {showDeviceChip ?
            <span className={cn(chatLogListChipClass, 'cursor-default max-w-[10rem]', 'truncate')} title={deviceText}>
              <Smartphone className="size-3 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
              <span className="min-w-0 truncate">{deviceText}</span>
            </span>
          : null}
        </div>
      ) : null}
    </div>
  );
}
