import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  Inbox,
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
import { BotSettingsFieldset } from '@/components/bot-workspace/BotSettingsFieldset';
import { cn } from '@/lib/utils';
import { toastPlaygroundSectionSaveFailed, toastPlaygroundSectionSaved } from '@/lib/playgroundSectionSaveToasts';
import { normalizeVisitorMultiChatMax } from '@/lib/visitorMultiChatMax';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import { buildChatExperienceChatUiSavePayload, mergeChatUiFromBot } from './chatUiPayload';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ChatExperienceQuickLinksTab } from './ChatExperienceQuickLinksTab';
import { ws } from './workspace';

const PAGE_TITLE = 'Chat Experience';
const CHAT_EXPERIENCE_SECTION_NAV_LABEL = 'Chat Experience';

type ChatExperienceTabId = 'input-tools' | 'messages' | 'chats' | 'header' | 'controls' | 'quick-links';

const CHAT_EXPERIENCE_TABS: { id: ChatExperienceTabId; label: string; hint: string; icon: LucideIcon }[] = [
  {
    id: 'input-tools',
    label: 'Input Tools',
    hint: 'Suggestions and how the composer behaves with them (chips are edited in Knowledge Base → Suggestions).',
    icon: Wrench,
  },
  {
    id: 'messages',
    label: 'Messages',
    hint: 'Copy, feedback, and how visitor message bubbles look.',
    icon: MessageSquare,
  },
  {
    id: 'chats',
    label: 'Multiple Conversations',
    hint: 'Whether visitors can keep several saved threads in the embedded widget.',
    icon: Inbox,
  },
  {
    id: 'header',
    label: 'Header',
    hint: 'Avatar and status in the chat header.',
    icon: PanelTop,
  },
  {
    id: 'controls',
    label: 'Panel & Scrolling',
    hint: 'When the panel opens, expand in menu, and how the message list scrolls.',
    icon: SlidersHorizontal,
  },
  {
    id: 'quick-links',
    label: 'Quick Links',
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

function getUserBubbleStyle(
  ui: Record<string, unknown>,
  key: 'userTextBubbleStyle' | 'userVoiceBubbleStyle',
): 'primary' | 'default' | 'defaultDark' {
  const v = ui[key];
  if (v === 'default') return 'default';
  if (v === 'defaultDark') return 'defaultDark';
  return 'primary';
}

function getScrollbarChromeStyle(ui: Record<string, unknown>): 'default' | 'defaultDark' | 'primary' {
  const v = ui.scrollChromeStyle;
  if (v === 'default' || v === 'defaultDark' || v === 'primary') return v;
  if (v === 'gray') return 'defaultDark';
  return getBool(ui, 'scrollChromeUsesPrimary', true) === false ? 'default' : 'primary';
}

function getScrollToBottomChromeStyle(ui: Record<string, unknown>): 'default' | 'defaultDark' | 'primary' {
  const v = ui.scrollToBottomChromeStyle;
  if (v === 'default' || v === 'defaultDark' || v === 'primary') return v;
  if (v === 'gray') return 'defaultDark';
  return getScrollbarChromeStyle(ui);
}

function getScrollToBottomAlign(ui: Record<string, unknown>): 'left' | 'center' | 'right' {
  const v = ui.scrollToBottomAlign;
  if (v === 'left' || v === 'right') return v;
  return 'center';
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

const CHAT_EXPERIENCE_PREVIEW_DEBOUNCE_MS = 150;

export function ChatExperienceSection() {
  const subnavId = useId();
  const { bot, botId, softReload, canManageBot } = useBotWorkspace();
  const { setAppearanceChatUiDraft, setChatsDraftSlice } = useCustomerWidgetPreview();
  const [chatUi, setChatUi] = useState<Record<string, unknown>>({});
  const [visitorMultiChatEnabled, setVisitorMultiChatEnabled] = useState(false);
  const [visitorMultiChatCapUnlimited, setVisitorMultiChatCapUnlimited] = useState(true);
  const [visitorMultiChatMax, setVisitorMultiChatMax] = useState('5');
  const [activeTab, setActiveTab] = useState<ChatExperienceTabId>('input-tools');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrateFromBot = useCallback(() => {
    if (!bot) return;
    setChatUi(mergeChatUiFromBot(bot.chatUI));
    const mEn = bot.visitorMultiChatEnabled === true;
    const mMax = bot.visitorMultiChatMax;
    setVisitorMultiChatEnabled(mEn);
    setVisitorMultiChatCapUnlimited(!mEn || mMax == null);
    setVisitorMultiChatMax(
      typeof mMax === 'number' && Number.isFinite(mMax) ? String(Math.max(2, Math.floor(mMax))) : '5',
    );
    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    hydrateFromBot();
  }, [hydrateFromBot]);

  useEffect(() => {
    return registerManualSaveGuard('chat-experience', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setAppearanceChatUiDraft({ ...chatUi });
    }, CHAT_EXPERIENCE_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [chatUi, setAppearanceChatUiDraft]);

  useEffect(() => {
    return () => setAppearanceChatUiDraft(null);
  }, [setAppearanceChatUiDraft]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const max = visitorMultiChatEnabled
        ? visitorMultiChatCapUnlimited
          ? null
          : normalizeVisitorMultiChatMax(visitorMultiChatMax) ?? 5
        : null;
      setChatsDraftSlice({
        visitorMultiChatEnabled,
        visitorMultiChatMax: max,
      });
    }, CHAT_EXPERIENCE_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [
    visitorMultiChatCapUnlimited,
    visitorMultiChatEnabled,
    visitorMultiChatMax,
    setChatsDraftSlice,
  ]);

  useEffect(() => {
    return () => setChatsDraftSlice(null);
  }, [setChatsDraftSlice]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveError(null);
  }, []);

  const onVisitorMultiChatEnabledChange = useCallback(
    (v: boolean) => {
      setVisitorMultiChatEnabled(v);
      if (v) setVisitorMultiChatCapUnlimited(true);
      markDirty();
    },
    [markDirty],
  );

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
      const parsedCap = visitorMultiChatEnabled
        ? visitorMultiChatCapUnlimited
          ? null
          : normalizeVisitorMultiChatMax(visitorMultiChatMax) ?? 5
        : null;
      const res = await patchCustomerBot(botId, {
        chatUI: buildChatExperienceChatUiSavePayload(bot.chatUI, chatUi),
        visitorMultiChatEnabled,
        visitorMultiChatMax: parsedCap,
      });
      setSaving(false);
      if (!res.ok) {
        setSaveError(res.error);
        toastPlaygroundSectionSaveFailed('chatExperience', res.error);
        return;
      }
      toastPlaygroundSectionSaved('chatExperience');
      setDirty(false);
      await softReload();
    },
    [
      bot,
      botId,
      chatUi,
      dirty,
      softReload,
      saving,
      visitorMultiChatCapUnlimited,
      visitorMultiChatEnabled,
      visitorMultiChatMax,
    ],
  );

  if (!bot || !botId) return null;

  const showScrollBlock = getBool(chatUi, 'showScrollToBottom', true);
  const showScrollLabelToggle = getBool(chatUi, 'showScrollToBottomLabel', true);
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
              {canManageBot ? (
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
              ) : null}
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

          <BotSettingsFieldset canManage={canManageBot}>
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
                        title="Input Tools"
                        description="How the composer works with suggestions from Knowledge Base → Suggestions. File uploads and voice live under AI & Advanced."
                      />
                      <div className="mt-4 space-y-0">
                        <ToggleRow
                          id="chat-composer-suggested"
                          label="Show composer with suggested questions"
                          description="When on, the input stays visible with suggested prompts. When off, visitors pick a suggestion first, then chat. Attachments and voice are configured under AI & Advanced."
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
                        description="Assistant copy and feedback, plus visitor text and voice bubble styling."
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
                          id="chat-show-message-feedback"
                          label="Show thumbs up / down on replies"
                          description="Collects helpful vs not helpful signals (stored with analytics for review)."
                          checked={getBool(chatUi, 'showMessageFeedback', true)}
                          onChange={(v) => patch('showMessageFeedback', v)}
                        />
                        <div className="border-b border-slate-100 py-3.5 last:border-b-0">
                          <FieldRow
                            label="Visitor text messages"
                            htmlFor="chat-user-text-bubble-style"
                            className="min-w-0 gap-1.5"
                            helperText="Applies only to typed text messages. Brand color fills with your brand color; default uses neutral thread styling."
                          >
                            <Select
                              id="chat-user-text-bubble-style"
                              quiet
                              value={getUserBubbleStyle(chatUi, 'userTextBubbleStyle')}
                              onChange={(e) =>
                                patch(
                                  'userTextBubbleStyle',
                                  e.target.value as 'primary' | 'default' | 'defaultDark',
                                )
                              }
                            >
                              <option value="primary">Brand color</option>
                              <option value="default">Default (neutral)</option>
                              <option value="defaultDark">Default (dark)</option>
                            </Select>
                          </FieldRow>
                        </div>
                        <div className="border-b border-slate-100 py-3.5 last:border-b-0">
                          <FieldRow
                            label="Visitor voice messages"
                            htmlFor="chat-user-voice-bubble-style"
                            className="min-w-0 gap-1.5"
                            helperText="Applies only to voice notes. Brand color uses a brand-filled bubble around the player; default uses a neutral bubble and standard waveform."
                          >
                            <Select
                              id="chat-user-voice-bubble-style"
                              quiet
                              value={getUserBubbleStyle(chatUi, 'userVoiceBubbleStyle')}
                              onChange={(e) =>
                                patch(
                                  'userVoiceBubbleStyle',
                                  e.target.value as 'primary' | 'default' | 'defaultDark',
                                )
                              }
                            >
                              <option value="primary">Brand color</option>
                              <option value="default">Default (neutral)</option>
                              <option value="defaultDark">Default (dark)</option>
                            </Select>
                          </FieldRow>
                        </div>
                      </div>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'chats' ? (
              <div
                id={`${subnavId}-chats-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-chats-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="chat-chats-h">
                      <WorkspaceSectionHeader
                        id="chat-chats-h"
                        title="Multiple Conversations"
                        description="How anonymous visitors use saved threads in the embedded widget (runtime embed)."
                      />
                      <div className="mt-4 space-y-0">
                        <ToggleRow
                          id="chat-visitor-multi-enabled"
                          label="Allow multiple saved conversations per visitor"
                          description="When off, visitors continue in their latest thread; older threads are read-only from Recent chats."
                          checked={visitorMultiChatEnabled}
                          onChange={onVisitorMultiChatEnabledChange}
                        />
                        <div className="rounded-lg border border-sky-200/90 bg-sky-50/90 px-3.5 py-3 text-[13px] leading-relaxed text-sky-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
                          <p className="font-semibold text-sky-900">How it works in the widget</p>
                          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sky-950/90">
                            <li>
                              <span className="font-medium">Off (single active thread):</span> visitors always continue in
                              their <em>latest</em> conversation. Older threads appear under “View recent chats” as{' '}
                              <strong>read-only</strong>.
                            </li>
                            <li>
                              <span className="font-medium">On (multiple saved threads):</span> visitors can open recent
                              threads and <strong>reply</strong> in any of them. “Start a new chat” and “End chat” only
                              appear while they are under the saved-conversation limit (unlimited = always available).
                            </li>
                          </ul>
                        </div>
                        {visitorMultiChatEnabled ? (
                          <div className="border-b border-slate-100 py-3.5 last:border-b-0">
                            <div className="min-w-0 flex-1">
                              <span className={ws.workspaceEditorControlLabel}>Saved conversations per visitor</span>
                              <p className={cn(ws.workspaceEditorControlHint, 'mt-1')}>
                                Unlimited lets visitors keep any number of threads. With a limit, they cannot start a new
                                thread once they reach the cap (they can still open existing threads).
                              </p>
                              <div className="mt-4 flex flex-col gap-3">
                                <label className="flex cursor-pointer items-start gap-2.5">
                                  <input
                                    type="radio"
                                    name="visitor-multi-chat-cap"
                                    className="mt-1 border-slate-300 text-[var(--color-primary)]"
                                    checked={visitorMultiChatCapUnlimited}
                                    onChange={() => {
                                      setVisitorMultiChatCapUnlimited(true);
                                      markDirty();
                                    }}
                                  />
                                  <span>
                                    <span className="block text-sm font-medium text-slate-900">Unlimited</span>
                                    <span className="mt-0.5 block text-xs text-slate-600">
                                      No maximum number of saved conversation threads per visitor.
                                    </span>
                                  </span>
                                </label>
                                <label className="flex cursor-pointer items-start gap-2.5">
                                  <input
                                    type="radio"
                                    name="visitor-multi-chat-cap"
                                    className="mt-1 border-slate-300 text-[var(--color-primary)]"
                                    checked={!visitorMultiChatCapUnlimited}
                                    onChange={() => {
                                      setVisitorMultiChatCapUnlimited(false);
                                      markDirty();
                                    }}
                                  />
                                  <span>
                                    <span className="block text-sm font-medium text-slate-900">Set a maximum</span>
                                    <span className="mt-0.5 block text-xs text-slate-600">
                                      Cap how many concurrent saved threads each visitor may have. Minimum 2—the current
                                      chat counts as one.
                                    </span>
                                  </span>
                                </label>
                                {!visitorMultiChatCapUnlimited ? (
                                  <div className="flex flex-wrap items-center gap-2 pl-7">
                                    <span className="text-sm text-slate-600">Up to</span>
                                    <Input
                                      id="visitor-multi-chat-max"
                                      type="number"
                                      min={2}
                                      step={1}
                                      quiet
                                      className="w-24"
                                      value={visitorMultiChatMax}
                                      onChange={(e) => {
                                        setVisitorMultiChatMax(e.target.value);
                                        markDirty();
                                      }}
                                      aria-label="Maximum saved conversations per visitor"
                                    />
                                    <span className="text-sm text-slate-600">saved conversations</span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
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
                            label="Header background"
                            htmlFor="chat-header-style"
                            className="min-w-0 gap-1.5"
                            helperText="Default keeps the neutral header strip. Brand color fills the bar with your accent and adjusts text and icons for contrast."
                          >
                            <Select
                              id="chat-header-style"
                              quiet
                              value={chatUi.headerStyle === 'brand' ? 'brand' : 'default'}
                              onChange={(e) =>
                                patch('headerStyle', e.target.value as 'default' | 'brand')
                              }
                            >
                              <option value="default">Default (neutral)</option>
                              <option value="brand">Brand color</option>
                            </Select>
                          </FieldRow>
                        </div>
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
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="chat-panel-scrolling-h">
                      <WorkspaceSectionHeader
                        id="chat-panel-scrolling-h"
                        title="Panel & Scrolling"
                        description="When the panel opens, expand in menu, and how the message list scrolls."
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
                            <div className="border-b border-slate-100 py-3.5">
                              <FieldRow
                                label="Scroll button alignment"
                                htmlFor="chat-scroll-to-bottom-align"
                                className="min-w-0 gap-1.5"
                                helperText="Horizontal placement of the floating scroll-to-latest control."
                              >
                                <Select
                                  id="chat-scroll-to-bottom-align"
                                  quiet
                                  value={getScrollToBottomAlign(chatUi)}
                                  onChange={(e) =>
                                    patch(
                                      'scrollToBottomAlign',
                                      e.target.value as 'left' | 'center' | 'right',
                                    )
                                  }
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </Select>
                              </FieldRow>
                            </div>
                          </>
                        ) : null}
                        <ToggleRow
                          id="chat-show-scrollbar"
                          label="Show message list scrollbar"
                          description="When off, the list still scrolls; the bar is hidden."
                          checked={getBool(chatUi, 'showScrollbar', true)}
                          onChange={(v) => patch('showScrollbar', v)}
                        />
                        <div className="border-b border-slate-100 py-3.5">
                          <FieldRow
                            label="Message list scrollbar"
                            htmlFor="chat-scrollbar-chrome-style"
                            className="min-w-0 gap-1.5"
                            helperText="Thumb color for the transcript scrollbar when it is visible."
                          >
                            <Select
                              id="chat-scrollbar-chrome-style"
                              quiet
                              value={getScrollbarChromeStyle(chatUi)}
                              onChange={(e) =>
                                patch(
                                  'scrollChromeStyle',
                                  e.target.value as 'default' | 'defaultDark' | 'primary',
                                )
                              }
                            >
                              <option value="default">Default</option>
                              <option value="defaultDark">Default (dark)</option>
                              <option value="primary">Brand color</option>
                            </Select>
                          </FieldRow>
                        </div>
                        <div className="border-b border-slate-100 py-3.5">
                          <FieldRow
                            label="Scroll to latest button"
                            htmlFor="chat-scroll-to-bottom-chrome-style"
                            className="min-w-0 gap-1.5"
                            helperText="Fill color for the floating control when the visitor scrolls up."
                          >
                            <Select
                              id="chat-scroll-to-bottom-chrome-style"
                              quiet
                              value={getScrollToBottomChromeStyle(chatUi)}
                              onChange={(e) =>
                                patch(
                                  'scrollToBottomChromeStyle',
                                  e.target.value as 'default' | 'defaultDark' | 'primary',
                                )
                              }
                            >
                              <option value="default">Default</option>
                              <option value="defaultDark">Default (dark)</option>
                              <option value="primary">Brand color</option>
                            </Select>
                          </FieldRow>
                        </div>
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
          </BotSettingsFieldset>
        </div>
      </form>
    </div>
  );
}
