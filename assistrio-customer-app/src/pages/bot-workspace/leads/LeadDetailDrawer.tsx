import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import type { CustomerLeadDetail, CustomerLeadFieldDefinition, CustomerConversationMessage } from '@/api/types';
import { getCustomerBotLeadDetail, getCustomerBotConversationMessages } from '@/api/customerApi';
import { Modal, Button } from '@/components/ui';
import { safeClientString } from '@/lib/safeClientString';
import { cn } from '@/lib/utils';
import { visibleLeadFieldDefinitions } from './leadsUiHelpers';
import { customerConversationInsightsPath } from './conversationInsightsDeepLink';
import { LeadDetailHeader } from './LeadDetailHeader';
import { LeadProfileSection } from './LeadProfileSection';
import { LeadConversationSection, LeadPageSourceSection } from './LeadAttributionSection';
import { LeadCaptureMessagesSection } from './LeadCaptureMessagesSection';
import { LeadLocationDeviceSection } from './LeadLocationDeviceSection';
import { LeadDetailDrawerSkeleton } from './LeadDetailDrawerSkeleton';
import { ConversationInsightsSheet } from '../conversations/ConversationInsightsSheet';

type Props = {
  open: boolean;
  botId: string;
  conversationId: string | null;
  listFieldDefinitions: CustomerLeadFieldDefinition[];
  detailReloadKey?: number;
  onClose: () => void;
};

export function LeadDetailDrawer({
  open,
  botId,
  conversationId,
  listFieldDefinitions,
  detailReloadKey = 0,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CustomerLeadDetail | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [err, setErr] = useState('');
  const reqSeq = useRef(0);
  const [messages, setMessages] = useState<CustomerConversationMessage[] | null>(null);
  const [msgState, setMsgState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const msgSeq = useRef(0);

  const load = useCallback(async () => {
    const cid = conversationId?.trim();
    if (!open || !cid) {
      setDetail(null);
      setState('idle');
      setErr('');
      return;
    }
    const seq = ++reqSeq.current;
    setState('loading');
    setErr('');
    setDetail(null);
    const res = await getCustomerBotLeadDetail(botId, cid);
    if (seq !== reqSeq.current) return;
    if (!res.ok) {
      setState('error');
      setErr(res.error || 'Could not load lead.');
      return;
    }
    setDetail(res.data);
    setState('ok');
  }, [open, botId, conversationId]);

  useEffect(() => {
    void load();
  }, [load, detailReloadKey]);

  useEffect(() => {
    if (state !== 'ok' || !detail?.conversationId?.trim()) {
      setMessages(null);
      setMsgState('idle');
      return;
    }
    const cid = detail.conversationId.trim();
    const seq = ++msgSeq.current;
    setMsgState('loading');
    setMessages(null);
    void (async () => {
      const res = await getCustomerBotConversationMessages(botId, cid);
      if (seq !== msgSeq.current) return;
      if (!res.ok) {
        setMsgState('error');
        return;
      }
      const body = res.data as { messages?: CustomerConversationMessage[] };
      setMessages(Array.isArray(body.messages) ? body.messages : []);
      setMsgState('ok');
    })();
  }, [state, detail?.conversationId, botId]);

  const defs = useMemo(() => {
    const fromDetail = detail?.leadFieldDefinitions;
    if (fromDetail?.length) return visibleLeadFieldDefinitions(fromDetail);
    return visibleLeadFieldDefinitions(listFieldDefinitions);
  }, [detail?.leadFieldDefinitions, listFieldDefinitions]);

  const openConversation = () => {
    if (!detail) return;
    navigate(customerConversationInsightsPath(botId, detail.conversationId));
  };

  return (
    <Modal
      open={open && Boolean(conversationId?.trim())}
      onClose={onClose}
      title=""
      hideHeader
      dialogAriaLabel="Lead details"
      size="lg"
      slideFrom="right"
      closeOnBackdropClick
      allowDismiss
      overlayClassName="!items-stretch !justify-end !p-0 z-[300]"
      className={cn(
        '!flex !max-h-none h-full max-h-[100dvh] w-full max-w-[min(100vw,40rem)] flex-col !rounded-none border-l border-slate-200/90 sm:max-w-[min(40rem,calc(100vw-0.5rem))]',
      )}
      bodyClassName="!flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      footerClassName="border-t border-slate-200/80 bg-slate-50/90"
      footer={
        <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative shrink-0 border-b border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 px-4 py-4 pr-14 sm:px-6 sm:pr-16">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600/30"
            aria-label="Close drawer"
          >
            <X size={18} strokeWidth={2} />
          </button>
          {state === 'loading' ? (
            <div className="space-y-2" aria-busy>
              <div className="h-6 w-52 animate-pulse rounded-md bg-slate-200/80" />
              <div className="h-4 w-64 animate-pulse rounded-md bg-slate-100" />
            </div>
          ) : state === 'ok' && detail ? (
            <div className="min-w-0 max-w-full">
              <LeadDetailHeader detail={detail} fieldDefinitions={defs} onOpenConversation={openConversation} />
            </div>
          ) : (
            <p className="m-0 text-sm text-slate-600">Lead</p>
          )}
        </div>

        <div className="insights-slim-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/40">
          {state === 'loading' ? (
            <div className="px-4 py-3 sm:px-6">
              <LeadDetailDrawerSkeleton />
            </div>
          ) : null}
          {state === 'error' ? (
            <div className="px-4 py-3 sm:px-6">
              <div
                className="rounded-xl border border-red-100 bg-red-50/90 px-4 py-5 text-sm text-red-800 shadow-sm"
                role="alert"
              >
                <p className="m-0 font-semibold text-red-900">Could not load this lead</p>
                <p className="m-0 mt-2 leading-relaxed text-red-800/90">
                  {safeClientString(err, 'Check your connection and try again.')}
                </p>
                <Button type="button" variant="outlinePrimary" size="sm" className="mt-5" onClick={() => void load()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : null}
          {state === 'ok' && detail ? (
            <div className="px-4 pb-4 pt-2 sm:px-6">
              <ConversationInsightsSheet className="border-0 bg-transparent shadow-none">
                <LeadProfileSection definitions={defs} capturedLeadData={detail.capturedLeadData} />
                <LeadCaptureMessagesSection
                  botId={botId}
                  detail={detail}
                  definitions={defs}
                  messages={messages}
                  msgLoadState={msgState}
                />
                <LeadPageSourceSection detail={detail} />
                <LeadLocationDeviceSection detail={detail} />
                <LeadConversationSection botId={botId} detail={detail} />
              </ConversationInsightsSheet>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
