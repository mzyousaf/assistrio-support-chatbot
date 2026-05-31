import { type ReactNode, useState } from 'react';
import type {
  CustomerConversationDetail,
  CustomerConversationListItem,
  CustomerConversationMessage,
} from '@/api/types';
import { Tooltip } from '@/components/ui';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { formatAnalyticsAiCreditsLabel } from '@/lib/analyticsFormat';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import {
  capitalizeWordsFromKey,
  conversationChannelLabel,
  conversationStatusPresentation,
  dashUnlessText,
  deviceTypeCustomerLabel,
  formatBrowserOsLine,
  INSIGHT_EM_DASH,
  screenSizeDisplay,
  sortedLeadPresentation,
  visitorOriginHref,
  visitorOriginLineDisplay,
  visitorPageHref,
  visitorPageLineDisplay,
  visitorReferrerHref,
  visitorReferrerLineDisplay,
} from './conversationInsightsFormatting';
import { MESSAGE_SENTIMENT_TAG_LABELS, topicSecondaryPillClass } from './conversationTopicSentimentDisplay';
import { SentimentTag, TopicTag } from './MessageTopicSentimentTags';
import { MessageCreditBadge } from './MessageCreditBadge';
import { ConversationDetailCopyButton } from './ConversationDetailCopyButton';
import {
  ConversationInsightsSheet,
  ConversationInsightsSheetRow,
  ConversationInsightsSheetSection,
  ConversationInsightsSheetUrlRow,
  conversationInsightsDetailOuterClassName,
} from './ConversationInsightsSheet';
import { formatCompactNumber } from './conversationDisplayFormat';
import { ConversationCreditBreakdownModal } from './ConversationCreditBreakdownModal';

/** Tooltips for General → Topic & sentiment row labels */
const GENERAL_TOPIC_PRIMARY_LABEL_HINT =
  'The main topic Analytics assigned to this chat, inferred from visitor messages.';
const GENERAL_TOPIC_OTHER_LABEL_HINT =
  'Extra topic labels on this thread besides the primary topic.';
const GENERAL_SENTIMENT_LABEL_HINT =
  'Sentiment summarizes visitor (user) messages in this conversation.';

type MsgState = 'idle' | 'loading' | 'ok' | 'error';

export type ConversationMsgLoadState = MsgState;

function ToneBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[12px] font-medium leading-snug tracking-tight',
        className,
      )}
    >
      {children}
    </span>
  );
}

function SubtleAssist({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('m-0 text-[12px] leading-relaxed text-slate-500', className)}>{children}</p>;
}

function statusBadgeClass(rawKey: string): string {
  if (rawKey === 'active') return 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900';
  if (rawKey === 'closed') return 'border-slate-200/85 bg-slate-50 text-slate-800';
  if (rawKey === 'abandoned') return 'border-amber-200/80 bg-amber-50/95 text-amber-950';
  return 'border-slate-200/85 bg-white text-slate-800';
}

export { conversationInsightsDetailOuterClassName } from './ConversationInsightsSheet';

function InsightsTagPlaceholder({ children }: { children: ReactNode }) {
  return <span className={cn(topicSecondaryPillClass, 'cursor-default')}>{children}</span>;
}

export function ConversationInsightsGeneralTab({
  listItem,
  detail,
  messages,
  msgState,
}: {
  listItem: CustomerConversationListItem;
  detail: CustomerConversationDetail;
  messages: CustomerConversationMessage[] | null;
  msgState: ConversationMsgLoadState;
}) {
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const canShowCreditDetails = msgState === 'ok' && messages != null;

  const cid = dashUnlessText(detail.conversationId || detail.id);
  const source = conversationChannelLabel(detail, listItem.startedFrom);
  const sentimentKey =
    typeof detail.conversationSentiment?.label === 'string' ? detail.conversationSentiment.label.trim().toLowerCase() : '';
  const showSentimentTag = Boolean(sentimentKey && MESSAGE_SENTIMENT_TAG_LABELS.has(sentimentKey));

  const ct = detail.conversationTopics;
  const primaryTopicId = ct?.primaryTopic?.trim() ?? '';
  const topicLabelIds = [
    ...new Set(
      (ct?.topicLabels ?? [])
        .filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
        .map((x) => x.trim()),
    ),
  ];
  const secondaryTopicIds = primaryTopicId ? topicLabelIds.filter((id) => id !== primaryTopicId) : topicLabelIds;

  const { customerLabel: statusLabel, rawKey: statusKey } = conversationStatusPresentation(detail.status);
  const lastAct = detail.lastActivityAt ?? listItem.lastActivityAt;
  const created = detail.createdAt ?? listItem.createdAt;

  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <ConversationInsightsSheet>
        <ConversationInsightsSheetSection title="Chat">
          <ConversationInsightsSheetRow
            label="Widget Channel"
            value={<ToneBadge className="border-teal-200/80 bg-teal-50/90 text-teal-900">{dashUnlessText(source)}</ToneBadge>}
          />
          <ConversationInsightsSheetRow
            label="Status"
            value={<ToneBadge className={cn(statusBadgeClass(statusKey))}>{statusLabel}</ToneBadge>}
          />
          <ConversationInsightsSheetRow
            label="Messages"
            value={<span className="tabular-nums text-slate-900">{formatCompactNumber(detail.totalMessages)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Total usage"
            value={
              <button
                type="button"
                disabled={!canShowCreditDetails}
                onClick={canShowCreditDetails ? () => setCreditModalOpen(true) : undefined}
                className={cn(
                  'm-0 border-none bg-transparent p-0 text-left',
                  canShowCreditDetails ? 'cursor-pointer' : 'cursor-default opacity-90',
                )}
                aria-label={
                  canShowCreditDetails
                    ? 'View credit details for this chat'
                    : 'Load chat to view credit details'
                }
              >
                <MessageCreditBadge creditCost={detail.totalCreditsUsed} />
              </button>
            }
          />
          <ConversationInsightsSheetRow label="Created" value={formatConversationAbsolute(created)} />
          <ConversationInsightsSheetRow
            label="Last activity"
            value={
              lastAct ? (
                <Tooltip content={formatConversationAbsolute(lastAct)} side="top" panelClassName="max-w-xs text-xs">
                  <span className="cursor-default border-b border-dotted border-slate-300/90 text-[13px] text-slate-900">
                    {formatConversationRelative(lastAct)}
                  </span>
                </Tooltip>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Chat ID"
            value={
              cid === INSIGHT_EM_DASH ? (
                cid
              ) : (
                <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[13px] text-slate-900">{cid}</span>
                  <ConversationDetailCopyButton value={cid} ariaLabel="Copy chat ID" />
                </span>
              )
            }
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Topic & sentiment">
          <ConversationInsightsSheetRow
            label="Primary topic"
            labelTooltip={GENERAL_TOPIC_PRIMARY_LABEL_HINT}
            value={
              primaryTopicId ? (
                <div className="flex min-w-0 flex-wrap gap-1">
                  <TopicTag topicId={primaryTopicId} />
                </div>
              ) : (
                <InsightsTagPlaceholder>Not analyzed</InsightsTagPlaceholder>
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Other topics"
            labelTooltip={GENERAL_TOPIC_OTHER_LABEL_HINT}
            value={
              secondaryTopicIds.length > 0 ? (
                <div className="flex min-w-0 flex-wrap gap-1">
                  {secondaryTopicIds.map((id) => (
                    <TopicTag key={id} topicId={id} />
                  ))}
                </div>
              ) : (
                <InsightsTagPlaceholder>Not analyzed</InsightsTagPlaceholder>
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Sentiment"
            labelTooltip={GENERAL_SENTIMENT_LABEL_HINT}
            value={
              showSentimentTag ? (
                <div className="flex min-w-0 flex-wrap gap-1">
                  <SentimentTag labelKey={sentimentKey} />
                </div>
              ) : (
                <InsightsTagPlaceholder>Not analyzed</InsightsTagPlaceholder>
              )
            }
          />
        </ConversationInsightsSheetSection>
      </ConversationInsightsSheet>
      <ConversationCreditBreakdownModal open={creditModalOpen} onClose={() => setCreditModalOpen(false)} messages={messages} />
    </div>
  );
}

function VisitorInsightsExternalLink({ href, displayText }: { href?: string; displayText: string }) {
  const plain = displayText.trim().length === 0 || displayText === INSIGHT_EM_DASH;
  if (!href || plain) {
    return <span className="break-all text-slate-600">{displayText}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex min-w-0 max-w-full cursor-pointer items-start rounded-sm font-normal outline-none',
        'focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      )}
    >
      <span className="inline-flex min-w-0 max-w-full items-start gap-1.5 border-b border-transparent pb-px text-slate-600 transition-[border-color,color] group-hover:border-teal-600 group-hover:text-teal-900">
        <span className="min-w-0 flex-1 break-all leading-snug">{displayText}</span>
        <ExternalLink
          className="mt-0.5 size-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-teal-900"
          strokeWidth={2}
          aria-hidden
        />
      </span>
    </a>
  );
}

export function ConversationInsightsVisitorTab({ detail }: { detail: CustomerConversationDetail }) {
  const l = detail.location;
  const dev = detail.deviceInfo;
  const { browserLine, osLine } = formatBrowserOsLine(dev?.browser, dev?.browserVersion, dev?.os, dev?.osVersion);

  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <ConversationInsightsSheet>
        <ConversationInsightsSheetSection
          title="Location"
          description="Approximate geography from network lookups."
        >
          <ConversationInsightsSheetRow label="Country" value={dashUnlessText(l?.country)} />
          <ConversationInsightsSheetRow label="Region" value={dashUnlessText(l?.region)} />
          <ConversationInsightsSheetRow label="City" value={dashUnlessText(l?.city)} />
          <ConversationInsightsSheetRow label="Timezone" value={dashUnlessText(l?.timezone)} />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Device">
          <ConversationInsightsSheetRow label="Device type" value={deviceTypeCustomerLabel(dev?.deviceType)} />
          <ConversationInsightsSheetRow label="Browser" value={browserLine} />
          <ConversationInsightsSheetRow label="OS" value={osLine} />
          <ConversationInsightsSheetRow label="Screen" value={screenSizeDisplay(dev?.screenWidth, dev?.screenHeight)} />
          <ConversationInsightsSheetRow label="Language" value={dashUnlessText(dev?.language)} />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Page source">
          <ConversationInsightsSheetRow
            label="Origin"
            value={<VisitorInsightsExternalLink href={visitorOriginHref(detail)} displayText={visitorOriginLineDisplay(detail)} />}
          />
          <ConversationInsightsSheetRow
            label="Page"
            value={<VisitorInsightsExternalLink href={visitorPageHref(detail)} displayText={visitorPageLineDisplay(detail)} />}
          />
          <ConversationInsightsSheetRow
            label="Referrer"
            value={<VisitorInsightsExternalLink href={visitorReferrerHref(detail)} displayText={visitorReferrerLineDisplay(detail)} />}
          />
        </ConversationInsightsSheetSection>
      </ConversationInsightsSheet>
    </div>
  );
}

export function ConversationInsightsUsageTab({
  detail,
  messages,
  msgState,
}: {
  detail: CustomerConversationDetail;
  messages: CustomerConversationMessage[] | null;
  msgState: MsgState;
}) {
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const canShowCreditDetails = msgState === 'ok' && messages != null;
  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <ConversationInsightsSheet>
        <ConversationInsightsSheetSection title="Message counts">
          <ConversationInsightsSheetRow
            label="Visitor messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.totalUserMessages)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Assistant messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.totalAssistantMessages)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Total messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.totalMessages)}</span>}
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Visitor modalities">
          <ConversationInsightsSheetRow
            label="Text messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.textMessageCount)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Voice messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.voiceMessageCount)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Dictation sessions"
            value={<span className="tabular-nums">{formatCompactNumber(detail.dictationMessageCount)}</span>}
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Attachments">
          <ConversationInsightsSheetRow
            label="Messages with attachments"
            value={<span className="tabular-nums">{formatCompactNumber(detail.attachmentMessageCount)}</span>}
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection
          title="AI Credits"
          description="Total visitor messaging usage billed on this chat."
        >
          <ConversationInsightsSheetRow
            label="Total"
            value={
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-[14px] font-semibold tabular-nums leading-snug text-slate-900">
                  {formatAnalyticsAiCreditsLabel(detail.totalCreditsUsed)}
                </span>
                {canShowCreditDetails ? (
                  <button
                    type="button"
                    className="m-0 self-start rounded-sm border-none bg-transparent p-0 text-left text-[12px] font-semibold text-teal-800 underline decoration-teal-600/35 underline-offset-2 hover:text-teal-900"
                    onClick={() => setCreditModalOpen(true)}
                  >
                    View breakdown
                  </button>
                ) : (
                  <span className="text-[12px] leading-snug text-slate-400">
                    Load the chat transcript to open the breakdown.
                  </span>
                )}
              </div>
            }
          />
        </ConversationInsightsSheetSection>
      </ConversationInsightsSheet>
      <ConversationCreditBreakdownModal open={creditModalOpen} onClose={() => setCreditModalOpen(false)} messages={messages} />
    </div>
  );
}

export function ConversationInsightsLeadTab({ detail }: { detail: CustomerConversationDetail }) {
  const rows = sortedLeadPresentation(detail.capturedLeadData ?? {});

  if (!detail.hasLead) {
    return (
      <div className={conversationInsightsDetailOuterClassName}>
        <ConversationInsightsSheet>
          <section className="p-10 text-center">
            <p className="m-0 text-[13px] font-semibold text-slate-900">No lead captured</p>
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-slate-600">No lead was captured in this chat.</p>
          </section>
        </ConversationInsightsSheet>
      </div>
    );
  }

  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <ConversationInsightsSheet>
        <ConversationInsightsSheetSection title="Lead status">
          <ConversationInsightsSheetRow
            label="Lead captured"
            value={<ToneBadge className="border-teal-200/80 bg-teal-50/95 text-teal-900">Yes</ToneBadge>}
          />
          <ConversationInsightsSheetRow
            label="Captured at"
            value={
              detail.leadCapturedAt ? (
                <Tooltip content={formatConversationAbsolute(detail.leadCapturedAt)} side="top" panelClassName="max-w-xs text-xs">
                  <span className="cursor-default border-b border-dotted border-slate-300/90 text-[13px] text-slate-900">
                    {formatConversationRelative(detail.leadCapturedAt)}
                  </span>
                </Tooltip>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection
          title="Captured fields"
          footer={
            !rows.length ? (
              <SubtleAssist>
                A submission exists, but field values weren&apos;t included in this export — check the transcript for answers.
                {detail.leadFieldKeys?.length ? (
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Expected keys: {detail.leadFieldKeys.map((k) => capitalizeWordsFromKey(k)).join(', ')}
                  </span>
                ) : null}
              </SubtleAssist>
            ) : undefined
          }
        >
          {rows.map((row) => (
            <ConversationInsightsSheetRow key={`${row.label}-${row.value}`} label={row.label} value={row.value} />
          ))}
        </ConversationInsightsSheetSection>
      </ConversationInsightsSheet>
    </div>
  );
}

export function ConversationInsightsAdvancedTab({
  listItem,
  detail,
  messages,
}: {
  listItem: CustomerConversationListItem;
  detail: CustomerConversationDetail;
  messages: CustomerConversationMessage[] | null;
}) {
  const o = detail.conversationOrigin;
  const l = detail.location;
  const statusRaw = conversationStatusPresentation(detail.status).rawKey;
  const cid = dashUnlessText(detail.conversationId || detail.id);
  const mids = messages?.map((m) => m.messageId || m.id).slice(0, 48) ?? [];
  const midsText = mids.length ? mids.join(', ') : '';

  let websiteOriginUrl: string | undefined;
  if (o?.websiteOrigin?.trim()) {
    websiteOriginUrl = /^https?:\/\//i.test(o.websiteOrigin) ? o.websiteOrigin : `https://${o.websiteOrigin}`;
  }

  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <ConversationInsightsSheet>
        <ConversationInsightsSheetSection title="Identifiers">
          <ConversationInsightsSheetRow
            label="Chat ID"
            value={
              cid === INSIGHT_EM_DASH ? (
                cid
              ) : (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12px] text-slate-900">{cid}</span>
                  <ConversationDetailCopyButton value={cid} ariaLabel="Copy chat ID" />
                </span>
              )
            }
          />
          <ConversationInsightsSheetRow
            label="AI Agent ID"
            value={
              detail.botId ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12px]">{detail.botId}</span>
                  <ConversationDetailCopyButton value={detail.botId} ariaLabel="Copy AI Agent ID" />
                </span>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Visitor chat ID"
            value={
              detail.chatVisitorId ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12px]">{detail.chatVisitorId}</span>
                  <ConversationDetailCopyButton value={detail.chatVisitorId} ariaLabel="Copy visitor chat id" />
                </span>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Analytics session ID"
            value={
              detail.sessionId ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12px]">{detail.sessionId}</span>
                  <ConversationDetailCopyButton value={detail.sessionId} ariaLabel="Copy session ID" />
                </span>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Legacy visitor bridge"
            value={
              detail.legacyVisitorId ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12px]">{detail.legacyVisitorId}</span>
                  <ConversationDetailCopyButton value={detail.legacyVisitorId} ariaLabel="Copy legacy visitor id" />
                </span>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Lead source message"
            value={
              detail.leadSourceMessagePreview?.trim() ? (
                <span className="inline-flex max-w-full flex-wrap items-start gap-2">
                  <span
                    className="line-clamp-3 min-w-0 max-w-[min(100%,28rem)] whitespace-pre-wrap break-words text-sm text-slate-800"
                    title={detail.leadSourceMessagePreview.trim()}
                  >
                    {detail.leadSourceMessagePreview.trim()}
                  </span>
                  <ConversationDetailCopyButton
                    value={detail.leadSourceMessagePreview.trim()}
                    ariaLabel="Copy lead source message"
                  />
                </span>
              ) : detail.leadSourceMessageId ? (
                <span className="text-sm text-slate-500">Message text unavailable</span>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Raw attribution">
          <ConversationInsightsSheetRow
            label="Started from"
            value={<span className="font-mono text-[12px]">{dashUnlessText(detail.startedFrom ?? listItem.startedFrom ?? undefined)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Session source"
            value={<span className="font-mono text-[12px]">{dashUnlessText(detail.sessionSource)}</span>}
          />
          <ConversationInsightsSheetRow label="Status" value={<span className="font-mono text-[12px]">{dashUnlessText(statusRaw)}</span>} />
          <ConversationInsightsSheetRow label="Origin mode" value={<span className="font-mono text-[12px]">{dashUnlessText(o?.mode)}</span>} />
          <ConversationInsightsSheetRow label="Embed transport" value={<span className="font-mono text-[12px]">{dashUnlessText(o?.embedType)}</span>} />
          <ConversationInsightsSheetRow label="Origin source enum" value={<span className="font-mono text-[12px]">{dashUnlessText(o?.source)}</span>} />
          <ConversationInsightsSheetRow
            label="Channel label"
            value={conversationChannelLabel(detail, listItem.startedFrom)}
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Sentiment">
          <ConversationInsightsSheetRow label="Label" value={<span>{dashUnlessText(detail.conversationSentiment?.label)}</span>} />
          <ConversationInsightsSheetRow
            label="Score"
            value={
              typeof detail.conversationSentiment?.score === 'number' && Number.isFinite(detail.conversationSentiment.score)
                ? `${detail.conversationSentiment.score}`
                : INSIGHT_EM_DASH
            }
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Location internals">
          <ConversationInsightsSheetRow label="Timezone / IP inference source" value={<span className="font-mono text-[11px]">{dashUnlessText(l?.source)}</span>} />
          <ConversationInsightsSheetRow label="Country code" value={dashUnlessText(l?.countryCode)} />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="URLs">
          <ConversationInsightsSheetUrlRow label="Page URL" url={o?.pageUrl} />
          <ConversationInsightsSheetUrlRow label="Referrer URL" url={o?.referrer} />
          <ConversationInsightsSheetUrlRow label="Website origin URL" url={websiteOriginUrl} />
          <ConversationInsightsSheetUrlRow label="Parent origin" url={o?.parentOrigin} />
          <ConversationInsightsSheetUrlRow label="Iframe URL" url={o?.iframeUrl} />
          <ConversationInsightsSheetUrlRow label="Shared URL" url={o?.sharedUrl} />
          <ConversationInsightsSheetRow label="Share slug" value={<span className="font-mono text-[12px]">{dashUnlessText(o?.shareSlug)}</span>} />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Loaded messages">
          <ConversationInsightsSheetRow
            label="Message IDs (preview)"
            value={
              midsText ? (
                <span className="break-all font-mono text-[11px] text-slate-800">{safeClientString(midsText)}</span>
              ) : (
                INSIGHT_EM_DASH
              )
            }
          />
        </ConversationInsightsSheetSection>
      </ConversationInsightsSheet>
    </div>
  );
}
