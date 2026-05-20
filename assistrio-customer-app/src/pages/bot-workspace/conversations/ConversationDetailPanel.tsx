import type {
  CustomerConversationDetail,
  CustomerConversationListItem,
  CustomerConversationMessage,
} from '@/api/types';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { InlineLoader } from '@/components/PageLoader';
import type { ConversationInsightsPrimaryTab } from './conversationInsightsTabs.types';
import type { ConversationMsgLoadState } from './conversationInsightsTabPanels';
import { conversationInsightsDetailOuterClassName } from './ConversationInsightsSheet';
import { ConversationInsightsAttachmentsTab } from './conversationInsightsAttachmentsTab';
import {
  ConversationInsightsAdvancedTab,
  ConversationInsightsGeneralTab,
  ConversationInsightsLeadTab,
  ConversationInsightsUsageTab,
  ConversationInsightsVisitorTab,
} from './conversationInsightsTabPanels';

type Props = {
  listItem: CustomerConversationListItem;
  detail: CustomerConversationDetail | null;
  detailState: 'idle' | 'loading' | 'ok' | 'error';
  detailError: string;
  onRetryDetail: () => void;
  messages: CustomerConversationMessage[] | null;
  msgState: ConversationMsgLoadState;
  msgError: string;
  onRetryMessages: () => void;
  insightsTab: Exclude<ConversationInsightsPrimaryTab, 'chat'>;
};

export function ConversationDetailPanel({
  listItem,
  detail,
  detailState,
  detailError,
  onRetryDetail,
  messages,
  msgState,
  msgError,
  onRetryMessages,
  insightsTab,
}: Props) {
  if (detailState === 'loading') {
    return (
      <div className={conversationInsightsDetailOuterClassName}>
        <div className="flex min-h-[12rem] flex-col justify-center py-10">
          <InlineLoader title="Loading details…" />
        </div>
      </div>
    );
  }

  if (detailState === 'error') {
    return (
      <div
        className={cn(conversationInsightsDetailOuterClassName, 'flex flex-col items-center justify-center gap-3 py-10 text-center')}
        role="alert"
      >
        <p className="m-0 text-sm font-medium text-slate-800">Couldn&apos;t load chat details</p>
        {detailError ? (
          <p className="m-0 max-w-md break-words text-xs text-slate-500">{safeClientString(detailError)}</p>
        ) : null}
        <Button type="button" variant="outlinePrimary" size="sm" onClick={onRetryDetail}>
          Retry
        </Button>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  switch (insightsTab) {
    case 'visitor':
      return <ConversationInsightsVisitorTab detail={detail} />;
    case 'usage':
      return <ConversationInsightsUsageTab detail={detail} messages={messages} msgState={msgState} />;
    case 'attachments':
      return (
        <ConversationInsightsAttachmentsTab
          messages={messages}
          msgState={msgState}
          msgError={msgError}
          onRetryMessages={onRetryMessages}
        />
      );
    case 'lead':
      return <ConversationInsightsLeadTab detail={detail} />;
    case 'advanced':
      return <ConversationInsightsAdvancedTab detail={detail} listItem={listItem} messages={messages} />;
    case 'general':
    default:
      return (
        <ConversationInsightsGeneralTab
          detail={detail}
          listItem={listItem}
          messages={messages}
          msgState={msgState}
        />
      );
  }
}
