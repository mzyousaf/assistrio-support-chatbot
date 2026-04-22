import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  Info,
  Link2,
  Loader2,
  MessageSquare,
  PanelTop,
  Save,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { patchCustomerBot } from '../../api/customerApi';
import { Button, Card, CardBody, FieldRow, Input, Select, Switch, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useBotWorkspace } from './BotWorkspaceContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import { buildChatExperienceChatUiSavePayload, mergeChatUiFromBot } from './chatUiPayload';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ChatExperienceQuickLinksTab } from './ChatExperienceQuickLinksTab';
import { ws } from './workspace';

const PAGE_TITLE = 'Chat Experience';
const CHAT_EXPERIENCE_SECTION_NAV_LABEL = 'Chat Experience';

type ChatExperienceTabId = 'input-tools' | 'messages' | 'header' | 'controls' | 'quick-links';

const CHAT_EXPERIENCE_TABS: { id: ChatExperienceTabId; label: string; hint: string; icon: LucideIcon }[] = [
  {
    id: 'input-tools',
    label: 'Input tools',
    hint: 'What visitors can use in the message input area.',
    icon: Wrench,
  },
  {
    id: 'messages',
    label: 'Messages',
    hint: 'Copy, sources, names, and timestamps on messages.',
    icon: MessageSquare,
  },
  {
    id: 'header',
    label: 'Header',
    hint: 'Avatar and status in the chat header.',
    icon: PanelTop,
  },
  {
    id: 'controls',
    label: 'Controls',
    hint: 'Scrolling, expanding the widget, and opening on load.',
    icon: SlidersHorizontal,
  },
  {
    id: 'quick-links',
    label: 'Quick links',
    hint: 'Header menu links visitors can open alongside the chat.',
    icon: Link2,
  },
];

function getBool(ui: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = ui[key];
  return typeof v === 'boolean' ? v : fallback;
}

function getStr(ui: Record<string, unknown>, key: string): string {
  const v = ui[key];
  return typeof v === 'string' ? v : '';
}

type ToggleRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  tooltip?: string;
};

function ToggleRow({ id, label, description, checked, onChange, tooltip }: ToggleRowProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span id={`${id}-label`} className={ws.workspaceEditorControlLabel}>
            {label}
          </span>
          {tooltip ? (
            <Tooltip content={tooltip}>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                aria-label={`About ${label}`}
              >
                <Info size={14} strokeWidth={1.75} aria-hidden />
              </button>
            </Tooltip>
          ) : null}
        </div>
        {description ? <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>{description}</p> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={`${id}-label`}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';

export function ChatExperienceSection() {
  const subnavId = useId();
  const { bot, botId, softReload } = useBotWorkspace();
  const [chatUi, setChatUi] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<ChatExperienceTabId>('input-tools');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrateFromBot = useCallback(() => {
    if (!bot) return;
    setChatUi(mergeChatUiFromBot(bot.chatUI));
    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    hydrateFromBot();
  }, [hydrateFromBot]);

  useEffect(() => {
    return registerManualSaveGuard('chat-experience', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError(null);
  }, []);

  const patch = useCallback(
    (key: string, value: unknown) => {
      setChatUi((prev) => ({ ...prev, [key]: value }));
      markDirty();
    },
    [markDirty],
  );

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!bot || !botId || saving || !dirty) return;
      setSaving(true);
      setSaveError(null);
      const res = await patchCustomerBot(botId, {
        chatUI: buildChatExperienceChatUiSavePayload(bot.chatUI, chatUi),
      });
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setDirty(false);
      await softReload();
    },
    [bot, botId, chatUi, dirty, softReload, saving],
  );

  if (!bot || !botId) return null;

  const botName = String(bot.name ?? '').trim();
  const senderPlaceholder = botName ? `${botName} - AI` : 'Bot name - AI';

  const showScrollBlock = getBool(chatUi, 'showScrollToBottom', true);
  const showScrollLabelToggle = getBool(chatUi, 'showScrollToBottomLabel', true);
  const showTime = getBool(chatUi, 'showTime', true);
  const showSenderName = getBool(chatUi, 'showSenderName', true);
  const statusRaw = chatUi.statusIndicator;
  const statusIndicator: 'none' | 'live' | 'active' =
    statusRaw === 'none' || statusRaw === 'live' || statusRaw === 'active' ? statusRaw : 'none';
  const showStatusStyles = statusIndicator === 'live' || statusIndicator === 'active';
  const activeMeta = CHAT_EXPERIENCE_TABS.find((t) => t.id === activeTab);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-chat-experience-editor>
      <form
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => void onSubmit(e)}
        aria-label="Chat Experience settings"
      >
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>{PAGE_TITLE}</h1>
                <p className={ws.workspaceEditorLead}>Configure how the chat behaves for visitors.</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col sm:pt-0">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!dirty || saving}
                className={cn(
                  ws.workspaceEditorButtonLabel,
                  'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[9.5rem]',
                )}
                aria-busy={saving || undefined}
                aria-label={saving ? 'Saving Chat Experience' : `Save ${CHAT_EXPERIENCE_SECTION_NAV_LABEL}`}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save Chat Experience
                  </>
                )}
              </Button>
            </div>
          </header>

          {saveError ? (
            <div
              className={cn(
                ws.workspaceEditorBannerText,
                'mb-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[var(--color-danger-text-emphasis)]',
              )}
            >
              {saveError}
            </div>
          ) : null}

          <div className={ws.workspaceEditorSubnavSection}>
            <div className={ws.workspaceEditorSubnavBar}>
              <div
                className="flex flex-wrap items-end gap-x-1 sm:gap-x-1.5"
                role="tablist"
                aria-label="Chat Experience sections"
                id={subnavId}
              >
                {CHAT_EXPERIENCE_TABS.map((tab) => {
                  const selected = activeTab === tab.id;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`${subnavId}-${tab.id}-panel`}
                      id={`${subnavId}-${tab.id}-tab`}
                      className={cn(
                        'relative z-[1] box-border -mb-px inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-t-md border border-solid px-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-3',
                        selected
                          ? 'border-slate-200 border-b-white bg-white text-[var(--color-teal-700)]'
                          : 'border-transparent text-slate-600 hover:border-slate-200/90 hover:bg-slate-50/60 hover:text-slate-900',
                      )}
                      onClick={() => {
                        setActiveTab(tab.id);
                      }}
                    >
                      <TabIcon size={16} strokeWidth={2} className="shrink-0 opacity-90" aria-hidden />
                      <span className="min-w-0 truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {activeMeta ? <p className={ws.workspaceEditorTabContext}>{activeMeta.hint}</p> : null}
          </div>

          <div className={ws.workspaceEditorCardGap}>
            {activeTab === 'input-tools' ? (
              <div
                id={`${subnavId}-input-tools-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-input-tools-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="chat-input-tools-h">
                      <WorkspaceSectionHeader
                        id="chat-input-tools-h"
                        title="Input tools"
                        description="What visitors can use in the message input area."
                      />
                      <div className="mt-4 space-y-0">
                        <ToggleRow
                          id="chat-allow-file"
                          label="Allow file uploads"
                          description="Let visitors attach files in the composer."
                          checked={getBool(chatUi, 'allowFileUpload', false)}
                          onChange={(v) => patch('allowFileUpload', v)}
                        />
                        <ToggleRow
                          id="chat-show-mic"
                          label="Show microphone"
                          description="Voice input requires an API key in AI & Responses when available."
                          checked={getBool(chatUi, 'showMic', false)}
                          onChange={(v) => patch('showMic', v)}
                        />
                        <ToggleRow
                          id="chat-show-emoji"
                          label="Show emoji picker"
                          description="Adds emoji insertion to the message input."
                          checked={getBool(chatUi, 'showEmoji', true)}
                          onChange={(v) => patch('showEmoji', v)}
                        />
                        <ToggleRow
                          id="chat-composer-suggested"
                          label="Show composer with suggested questions"
                          description="When on, the input stays visible with suggested prompts. When off, visitors pick a suggestion first, then chat."
                          checked={getBool(chatUi, 'showComposerWithSuggestedQuestions', false)}
                          onChange={(v) => patch('showComposerWithSuggestedQuestions', v)}
                        />
                      </div>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'messages' ? (
              <div
                id={`${subnavId}-messages-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-messages-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="chat-messages-h">
                      <WorkspaceSectionHeader
                        id="chat-messages-h"
                        title="Messages"
                        description="Copy, sources, names, and timestamps on messages."
                      />
                      <div className="mt-4 space-y-0">
                        <ToggleRow
                          id="chat-show-copy"
                          label="Show copy button"
                          description="Lets visitors copy assistant replies to the clipboard."
                          checked={getBool(chatUi, 'showCopyButton', true)}
                          onChange={(v) => patch('showCopyButton', v)}
                        />
                        <ToggleRow
                          id="chat-show-sources"
                          label="Show sources"
                          description="Shows citations or references when the reply uses retrieved context."
                          checked={getBool(chatUi, 'showSources', true)}
                          onChange={(v) => patch('showSources', v)}
                        />
                        <ToggleRow
                          id="chat-show-sender-name"
                          label="Show assistant name"
                          description="Displays a name label on assistant messages in the thread."
                          checked={showSenderName}
                          onChange={(v) => patch('showSenderName', v)}
                        />
                        {showSenderName ? (
                          <div className="border-b border-slate-100 py-3.5">
                            <FieldRow
                              label="Custom assistant name"
                              htmlFor="chat-sender-name"
                              helperText={`Shown above assistant messages. Leave blank to use “${senderPlaceholder}”.`}
                              className="min-w-0 gap-1.5"
                            >
                              <Input
                                id="chat-sender-name"
                                quiet
                                value={getStr(chatUi, 'senderName')}
                                onChange={(e) => patch('senderName', e.target.value)}
                                placeholder={senderPlaceholder}
                                autoComplete="off"
                              />
                            </FieldRow>
                          </div>
                        ) : null}
                        <ToggleRow
                          id="chat-show-time"
                          label="Show message time"
                          checked={showTime}
                          onChange={(v) => patch('showTime', v)}
                        />
                        {showTime ? (
                          <div className="py-3.5">
                            <FieldRow
                              label="Time position"
                              htmlFor="chat-time-position"
                              className="min-w-0 gap-1.5"
                              helperText="Where the timestamp appears relative to each message."
                            >
                              <Select
                                id="chat-time-position"
                                quiet
                                value={chatUi.timePosition === 'bottom' ? 'bottom' : 'top'}
                                onChange={(e) => patch('timePosition', e.target.value)}
                              >
                                <option value="top">Above message</option>
                                <option value="bottom">Below (assistant right, user left)</option>
                              </Select>
                            </FieldRow>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'header' ? (
              <div
                id={`${subnavId}-header-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-header-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="chat-header-h">
                      <WorkspaceSectionHeader
                        id="chat-header-h"
                        title="Header"
                        description="Avatar and status in the chat header."
                      />
                      <div className="mt-4 space-y-0">
                        <ToggleRow
                          id="chat-show-avatar-header"
                          label="Show avatar in header"
                          description="Shows the bot image or icon at the top of the chat panel."
                          checked={getBool(chatUi, 'showAvatarInHeader', true)}
                          onChange={(v) => patch('showAvatarInHeader', v)}
                        />
                        <div className="border-b border-slate-100 py-3.5">
                          <FieldRow
                            label="Status indicator"
                            htmlFor="chat-status-indicator"
                            className="min-w-0 gap-1.5"
                            helperText="Optional live/active state shown in the header."
                          >
                            <Select
                              id="chat-status-indicator"
                              quiet
                              value={statusIndicator}
                              onChange={(e) =>
                                patch('statusIndicator', e.target.value as 'none' | 'live' | 'active')
                              }
                            >
                              <option value="none">None</option>
                              <option value="live">Live</option>
                              <option value="active">Active</option>
                            </Select>
                          </FieldRow>
                        </div>
                        {showStatusStyles ? (
                          <div
                            className={cn(ws.workspaceEditorFieldPairGrid, 'border-b border-slate-100 py-3.5')}
                          >
                            <div className="min-w-0">
                              <FieldRow
                                label="Indicator style"
                                htmlFor="chat-live-style"
                                className="min-w-0 gap-1.5"
                                helperText="How the status is shown next to the name or avatar."
                              >
                                <Select
                                  id="chat-live-style"
                                  quiet
                                  value={chatUi.liveIndicatorStyle === 'dot-only' ? 'dot-only' : 'label'}
                                  onChange={(e) => patch('liveIndicatorStyle', e.target.value)}
                                >
                                  <option value="label">Label + dot (next to name)</option>
                                  <option value="dot-only">Dot on avatar only</option>
                                </Select>
                              </FieldRow>
                            </div>
                            <div className="min-w-0">
                              <FieldRow
                                label="Dot style"
                                htmlFor="chat-dot-style"
                                className="min-w-0 gap-1.5"
                                helperText="Motion for the status dot when shown."
                              >
                                <Select
                                  id="chat-dot-style"
                                  quiet
                                  value={chatUi.statusDotStyle === 'static' ? 'static' : 'blinking'}
                                  onChange={(e) => patch('statusDotStyle', e.target.value)}
                                >
                                  <option value="blinking">Blinking</option>
                                  <option value="static">Static</option>
                                </Select>
                              </FieldRow>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'controls' ? (
              <div
                id={`${subnavId}-controls-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-controls-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="chat-controls-h">
                      <WorkspaceSectionHeader
                        id="chat-controls-h"
                        title="Controls"
                        description="Scrolling, expanding the widget, and opening on load."
                      />
                      <div className="mt-4 space-y-0">
                        <ToggleRow
                          id="chat-scroll-bottom"
                          label="Scroll to latest button"
                          description="Shown when the visitor scrolls up in the transcript."
                          checked={showScrollBlock}
                          onChange={(v) => patch('showScrollToBottom', v)}
                        />
                        {showScrollBlock ? (
                          <>
                            <ToggleRow
                              id="chat-scroll-label-show"
                              label="Show label next to scroll button"
                              description="Shows text beside the control; turn off for icon-only."
                              checked={showScrollLabelToggle}
                              onChange={(v) => patch('showScrollToBottomLabel', v)}
                            />
                            {showScrollLabelToggle ? (
                              <div className="border-b border-slate-100 py-3.5">
                                <FieldRow
                                  label="Scroll button label"
                                  htmlFor="chat-scroll-label-text"
                                  helperText='Empty uses the default (e.g. “Scroll to latest”).'
                                  className="min-w-0 gap-1.5"
                                >
                                  <Input
                                    id="chat-scroll-label-text"
                                    quiet
                                    value={getStr(chatUi, 'scrollToBottomLabel')}
                                    onChange={(e) => patch('scrollToBottomLabel', e.target.value)}
                                    placeholder="Scroll to latest"
                                    autoComplete="off"
                                  />
                                </FieldRow>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        <ToggleRow
                          id="chat-show-scrollbar"
                          label="Show message list scrollbar"
                          description="When off, the list still scrolls; the bar is hidden."
                          checked={getBool(chatUi, 'showScrollbar', true)}
                          onChange={(v) => patch('showScrollbar', v)}
                        />
                        <ToggleRow
                          id="chat-menu-expand"
                          label="Show “Expand chat” in menu"
                          description="Offers a larger layout when the embed supports it."
                          checked={getBool(chatUi, 'showMenuExpand', true)}
                          onChange={(v) => patch('showMenuExpand', v)}
                        />
                        <ToggleRow
                          id="chat-open-load"
                          label="Open chat on page load"
                          description="Where the embed supports it, opens the panel automatically."
                          checked={getBool(chatUi, 'openChatOnLoad', true)}
                          onChange={(v) => patch('openChatOnLoad', v)}
                        />
                      </div>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'quick-links' ? (
              <div
                id={`${subnavId}-quick-links-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-quick-links-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <ChatExperienceQuickLinksTab chatUi={chatUi} patch={patch} cardClass={cardClass} />
              </div>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
