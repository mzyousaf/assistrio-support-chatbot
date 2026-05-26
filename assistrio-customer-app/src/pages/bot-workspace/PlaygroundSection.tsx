import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { postCustomerBotChat } from '../../api/customerApi';
import { useCustomerAuth } from '../../auth/CustomerAuthContext';
import { resolveActiveCustomerWorkspace } from '../../lib/resolveActiveCustomerWorkspace';
import {
  PLAN_LIMIT_AI_CREDITS_CODE,
  resolveChatRuntimeErrorMessage,
} from '../../lib/resolveChatRuntimeErrorMessage';
import { isWorkspaceManagerRole } from '../../lib/workspaceRoles';
import { useBotWorkspace } from './BotWorkspaceContext';
import { ws } from './workspace';
import { PageIntroStrip, SplitPanelLayout, SupportPanel, WorkspaceContentContainer } from '@/layout/workspace-layout';
import { Button, Textarea } from '@/components/ui';

type Turn = { id: string; role: 'user' | 'assistant'; text: string };

const storageKey = (botId: string) => `assistrio_customer_playground_${botId}`;

export function PlaygroundSection() {
  const { bot, botId } = useBotWorkspace();
  const { customer } = useCustomerAuth();
  const { role } = resolveActiveCustomerWorkspace(customer);
  const canViewPlans = isWorkspaceManagerRole(role);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);

  useEffect(() => {
    if (!botId) return;
    try {
      const raw = sessionStorage.getItem(storageKey(botId));
      if (!raw) { setMessages([]); return; }
      const parsed = JSON.parse(raw) as Turn[];
      if (Array.isArray(parsed)) setMessages(parsed.filter((m) => m.id && m.role && m.text));
    } catch {
      setMessages([]);
    }
  }, [botId]);

  const persist = useCallback(
    (next: Turn[]) => {
      if (!botId) return;
      try { sessionStorage.setItem(storageKey(botId), JSON.stringify(next)); } catch { /* ignore */ }
    },
    [botId],
  );

  if (!bot || !botId) return null;
  const id = botId;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setErr(null);
    setErrCode(null);
    const userTurn: Turn = { id: crypto.randomUUID(), role: 'user', text };
    const next = [...messages, userTurn];
    setMessages(next);
    persist(next);
    setInput('');
    setSending(true);
    const res = await postCustomerBotChat(id, { message: text });
    setSending(false);
    if (!res.ok) {
      setErr(resolveChatRuntimeErrorMessage(res));
      setErrCode(res.errorCode ?? null);
      return;
    }
    const asst: Turn = { id: crypto.randomUUID(), role: 'assistant', text: res.data.assistantMessage ?? '' };
    const withAsst = [...next, asst];
    setMessages(withAsst);
    persist(withAsst);
  }

  function clearThread() {
    setMessages([]);
    try { sessionStorage.removeItem(storageKey(id)); } catch { /* ignore */ }
  }

  return (
    <WorkspaceContentContainer size="wide">
      <PageIntroStrip
        title="Playground"
        description="Signed-in test chat via the builder API — separate from the public embed path."
      />

      <SplitPanelLayout
        primary={
          <div
            className="rounded-xl border bg-white p-4 shadow-[var(--shadow-card)] md:p-5"
            style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 92%, #0f766e 8%)' }}
          >
            {err ? (
              <div className={ws.err}>
                <p className="m-0">{err}</p>
                {errCode === PLAN_LIMIT_AI_CREDITS_CODE && canViewPlans ? (
                  <Link to="/settings/plans" className="mt-2 inline-block text-sm font-medium text-teal-700 underline">
                    View plans
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="mb-3 flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              {messages.length === 0 ? (
                <p className={ws.workspacePageLead}>
                  Send a message to see how your assistant replies.
                </p>
              ) : (
                messages.map((m) =>
                  m.role === 'user' ? (
                    <div key={m.id} className={ws.bubbleUser}>
                      {m.text}
                    </div>
                  ) : (
                    <div key={m.id} className={ws.bubbleAsst}>
                      {m.text}
                    </div>
                  ),
                )
              )}
            </div>

            <div className="flex items-end gap-2">
              <Textarea
                quiet
                className="min-h-[2.75rem] flex-1"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a test question…"
              />
              <Button type="button" variant="primary" size="sm" className="shrink-0" disabled={sending} onClick={() => void send()}>
                {sending ? '…' : 'Send'}
              </Button>
            </div>

            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={clearThread}>
              Clear thread
            </Button>
          </div>
        }
        secondary={
          <>
            <SupportPanel title="Status">
              <p className="m-0 text-sm leading-relaxed text-slate-600">
                {bot.status === 'published' ? (
                  <span className="font-medium text-teal-700">Published</span>
                ) : (
                  <>
                    <span className="font-medium text-amber-800">Draft</span>
                    <span className="text-slate-500">
                      {' '}
                      — chat works for testing; publish before the live widget.
                    </span>
                  </>
                )}
              </p>
            </SupportPanel>
            <SupportPanel title="Tips">
              <ul className="m-0 list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600">
                <li>Use realistic questions your visitors ask.</li>
                <li>Shift+Enter adds a newline; Enter sends.</li>
                <li>Thread is stored in this browser only.</li>
              </ul>
            </SupportPanel>
          </>
        }
      />
    </WorkspaceContentContainer>
  );
}
