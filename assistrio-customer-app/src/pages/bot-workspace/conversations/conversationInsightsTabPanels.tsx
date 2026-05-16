import { type ReactNode, useState } from 'react';
import type { CustomerConversationDetail, CustomerConversationListItem, CustomerConversationMessage } from '@/api/types';
import { Tooltip } from '@/components/ui';
import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import {
  capitalizeWordsFromKey,
  conversationChannelLabel,
  conversationStatusPresentation,
  dashUnlessText,
  deviceTypeCustomerLabel,
  formatBrowserOsLine,
  formatConversationOriginSourceType,
  INSIGHT_EM_DASH,
  sanitizedHostname,
  screenSizeDisplay,
  sentimentCustomerLabel,
  sortedLeadPresentation,
  visitorPageLineDisplay,
} from './conversationInsightsFormatting';
import { topicTaxonomyCustomerLabel } from './conversationTopicSentimentDisplay';
import { ConversationDetailCopyButton } from './ConversationDetailCopyButton';
import {
  ConversationInsightsSheet,
  ConversationInsightsSheetRow,
  ConversationInsightsSheetSection,
  ConversationInsightsSheetUrlRow,
  conversationInsightsDetailOuterClassName,
} from './ConversationInsightsSheet';
import { formatCompactNumber, formatCreditAmount } from './conversationDisplayFormat';
import { ConversationCreditBreakdownModal } from './ConversationCreditBreakdownModal';

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

function sentimentToneBadgeClass(sentimentKey: string): string {
  const k = sentimentKey.trim().toLowerCase();
  if (!k || k === 'unknown') return 'border-slate-200/85 bg-slate-50 text-slate-800';
  if (k === 'positive') return 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900';
  if (k === 'neutral') return 'border-slate-200/85 bg-slate-50 text-slate-800';
  if (k === 'negative') return 'border-rose-200/80 bg-rose-50/95 text-rose-900';
  if (k === 'mixed') return 'border-violet-200/80 bg-violet-50/95 text-violet-900';
  return 'border-slate-200/85 bg-slate-50 text-slate-800';
}

export { conversationInsightsDetailOuterClassName } from './ConversationInsightsSheet';

export function ConversationInsightsGeneralTab({
  listItem,
  detail,
}: {
  listItem: CustomerConversationListItem;
  detail: CustomerConversationDetail;
}) {
  const cid = dashUnlessText(detail.conversationId || detail.id);
  const source = conversationChannelLabel(detail, listItem.startedFrom);
  const sentimentKey =
    typeof detail.conversationSentiment?.label === 'string' ? detail.conversationSentiment.label.trim().toLowerCase() : '';
  const sentimentSummary = sentimentCustomerLabel(detail);
  const ct = detail.conversationTopics;
  const primaryTopicDisplay = ct?.primaryTopic?.trim()
    ? topicTaxonomyCustomerLabel(ct.primaryTopic)
    : 'Not analyzed';
  const topicLabelIds = ct?.topicLabels ?? [];
  const topicsLineDisplay =
    topicLabelIds.length > 0
      ? [...new Set(topicLabelIds.map((id) => topicTaxonomyCustomerLabel(id)))].join(', ')
      : 'Not analyzed';
  const { customerLabel: statusLabel, rawKey: statusKey } = conversationStatusPresentation(detail.status);
  const lastAct = detail.lastActivityAt ?? listItem.lastActivityAt;
  const created = detail.createdAt ?? listItem.createdAt;

  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <ConversationInsightsSheet>
        <ConversationInsightsSheetSection title="Conversation">
          <ConversationInsightsSheetRow
            label="Source"
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
            value={<span className="tabular-nums text-slate-900">{formatCreditAmount(detail.totalCreditsUsed)}</span>}
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
            label="Conversation ID"
            value={
              cid === INSIGHT_EM_DASH ? (
                cid
              ) : (
                <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[13px] text-slate-900">{cid}</span>
                  <ConversationDetailCopyButton value={cid} ariaLabel="Copy conversation ID" />
                </span>
              )
            }
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Topic & sentiment">
          <ConversationInsightsSheetRow label="Primary topic" value={primaryTopicDisplay} />
          <ConversationInsightsSheetRow label="Topics" value={topicsLineDisplay} />
          <ConversationInsightsSheetRow
            label="Sentiment"
            value={<ToneBadge className={sentimentToneBadgeClass(sentimentKey)}>{sentimentSummary}</ToneBadge>}
          />
        </ConversationInsightsSheetSection>
      </ConversationInsightsSheet>
    </div>
  );
}

export function ConversationInsightsVisitorTab({ detail }: { detail: CustomerConversationDetail }) {
  const l = detail.location;
  const o = detail.conversationOrigin;
  const dev = detail.deviceInfo;
  const { browserLine, osLine } = formatBrowserOsLine(dev?.browser, dev?.browserVersion, dev?.os, dev?.osVersion);

  return (
    <div className={conversationInsightsDetailOuterClassName}>
      <ConversationInsightsSheet>
        <ConversationInsightsSheetSection
          title="Location"
          description="Approximate geography from network lookups or visitor browser hints."
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
            label="Source type"
            value={dashUnlessText(o?.source ? formatConversationOriginSourceType(o.source) : undefined)}
          />
          <ConversationInsightsSheetRow label="Page" value={visitorPageLineDisplay(detail)} />
          <ConversationInsightsSheetRow label="Referrer" value={dashUnlessText(sanitizedHostname(o?.referrer))} />
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
        <ConversationInsightsSheetSection title="Messages">
          <ConversationInsightsSheetRow
            label="Total messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.totalMessages)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Visitor messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.totalUserMessages)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Assistant messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.totalAssistantMessages)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Text messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.textMessageCount)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Voice messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.voiceMessageCount)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Dictation used in messages"
            value={<span className="tabular-nums">{formatCompactNumber(detail.dictationMessageCount)}</span>}
          />
          <ConversationInsightsSheetRow
            label="Attachments"
            value={<span className="tabular-nums">{formatCompactNumber(detail.attachmentMessageCount)}</span>}
          />
        </ConversationInsightsSheetSection>

        <ConversationInsightsSheetSection title="Credits">
          <ConversationInsightsSheetRow
            label="Credits used"
            value={
              <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  disabled={!canShowCreditDetails}
                  onClick={canShowCreditDetails ? () => setCreditModalOpen(true) : undefined}
                  className={cn(
                    'm-0 border-none bg-transparent p-0 text-left tabular-nums underline decoration-teal-600/35 underline-offset-2',
                    canShowCreditDetails
                      ? 'cursor-pointer font-semibold text-slate-900 hover:text-teal-900'
                      : 'cursor-default text-slate-900 opacity-95',
                  )}
                >
                  {formatCreditAmount(detail.totalCreditsUsed)}
                </button>
                {canShowCreditDetails ? (
                  <button
                    type="button"
                    className="m-0 cursor-pointer rounded-sm border-none bg-transparent p-0 text-left text-[11px] font-semibold tracking-tight text-teal-800 underline decoration-teal-600/35 underline-offset-2 hover:text-teal-900"
                    onClick={() => setCreditModalOpen(true)}
                  >
                    View details
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">Load chat to drill down</span>
                )}
              </span>
            }
          />
        </ConversationInsightsSheetSection>
      </ConversationInsightsSheet>
      <ConversationCreditBreakdownModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        conversationTotalCreditsUsed={detail.totalCreditsUsed}
        messages={messages}
      />
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
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-slate-600">No lead was captured in this conversation.</p>
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
            label="Conversation ID"
            value={
              cid === INSIGHT_EM_DASH ? (
                cid
              ) : (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12px] text-slate-900">{cid}</span>
                  <ConversationDetailCopyButton value={cid} ariaLabel="Copy conversation id" />
                </span>
              )
            }
          />
          <ConversationInsightsSheetRow
            label="Bot ID"
            value={
              detail.botId ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12px]">{detail.botId}</span>
                  <ConversationDetailCopyButton value={detail.botId} ariaLabel="Copy bot ID" />
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
