import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Loader2, Palette, Rocket, Save, SeparatorHorizontal, type LucideIcon } from 'lucide-react';
import { patchCustomerBot } from '../../api/customerApi';
import { Button, Card, CardBody, FieldRow, Input, Range, Select, Switch, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PRIMARY_HEX,
  normalizePrimaryColor,
  sanitizePrimaryColorInput,
} from '@/lib/primaryColorNormalize';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import { buildWidgetAppearanceChatUiSavePayload, mergeChatUiFromBot } from './chatUiPayload';
import { CHAT_UI_BRANDING_MESSAGE_MAX_LENGTH, CHAT_UI_PRIVACY_TEXT_MAX_LENGTH } from './chatUiLimits';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ws } from './workspace';

const PAGE_TITLE = 'Widget Appearance';
const WIDGET_APPEARANCE_SECTION_NAV_LABEL = 'Widget Appearance';

const BUBBLE_RADIUS_MIN = 0;
const BUBBLE_RADIUS_MAX = 32;
const CHAT_PANEL_BORDER_MAX = 5;
const LAUNCHER_SIZE_MIN = 32;
const LAUNCHER_SIZE_MAX = 96;
const RING_WIDTH_MAX = 30;
const COMPOSER_BORDER_MAX = 6;
const LAUNCHER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

type WidgetAppearanceTabId = 'branding-theme' | 'launcher-animation' | 'composer';

const WIDGET_APPEARANCE_TABS: { id: WidgetAppearanceTabId; label: string; hint: string; icon: LucideIcon }[] = [
  {
    id: 'branding-theme',
    label: 'Branding & Theme',
    hint: 'Colors, surfaces, and footer lines.',
    icon: Palette,
  },
  {
    id: 'launcher-animation',
    label: 'Launcher & Animation',
    hint: 'Launcher controls and how the panel opens.',
    icon: Rocket,
  },
  {
    id: 'composer',
    label: 'Composer',
    hint: 'Separate input box and optional border styling.',
    icon: SeparatorHorizontal,
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

function getNum(ui: Record<string, unknown>, key: string, fallback: number): number {
  const v = ui[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function snapComposerBorderWidth(n: number, max: number): number {
  const c = clamp(n, 0, max);
  if (c > 0 && c < 0.5) return 0.5;
  return Math.round(c * 2) / 2;
}

const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';

type ToggleRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span id={`${id}-label`} className={ws.workspaceEditorControlLabel}>
          {label}
        </span>
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

const APPEARANCE_PREVIEW_DEBOUNCE_MS = 150;

export function WidgetAppearanceSection() {
  const subnavId = useId();
  const launcherFileRef = useRef<HTMLInputElement>(null);
  const { bot, botId, softReload } = useBotWorkspace();
  const { setAppearanceChatUiDraft } = useCustomerWidgetPreview();
  const [chatUi, setChatUi] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<WidgetAppearanceTabId>('branding-theme');
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
    return registerManualSaveGuard('widget-appearance', () => dirty, hydrateFromBot);
  }, [dirty, hydrateFromBot]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setAppearanceChatUiDraft({ ...chatUi });
    }, APPEARANCE_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [chatUi, setAppearanceChatUiDraft]);

  useEffect(() => {
    return () => setAppearanceChatUiDraft(null);
  }, [setAppearanceChatUiDraft]);

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
        chatUI: buildWidgetAppearanceChatUiSavePayload(bot.chatUI, chatUi),
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

  const primaryColor = getStr(chatUi, 'primaryColor') || DEFAULT_PRIMARY_HEX;
  const colorPickerValue = normalizePrimaryColor(primaryColor);

  const launcherIcon =
    chatUi.launcherIcon === 'bot-avatar' || chatUi.launcherIcon === 'custom'
      ? chatUi.launcherIcon
      : 'default';
  const showRingControl = launcherIcon === 'bot-avatar' || launcherIcon === 'custom';
  const showCustomAvatarUrl = launcherIcon === 'custom';

  const composerSeparate = getBool(chatUi, 'composerAsSeparateBox', true);

  const activeMeta = WIDGET_APPEARANCE_TABS.find((t) => t.id === activeTab);

  if (!bot || !botId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-widget-appearance-editor>
      <form
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => void onSubmit(e)}
        aria-label="Widget Appearance settings"
      >
        <div className="w-full min-w-0 flex-1 pb-10">
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>{PAGE_TITLE}</h1>
                <p className={ws.workspaceEditorLead}>
                  Customize the widget’s look, launcher, composer, and footer branding.
                </p>
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
                aria-label={
                  saving ? 'Saving Widget Appearance' : `Save ${WIDGET_APPEARANCE_SECTION_NAV_LABEL}`
                }
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save Widget Appearance
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
                aria-label="Widget Appearance sections"
                id={subnavId}
              >
                {WIDGET_APPEARANCE_TABS.map((tab) => {
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
            {activeTab === 'branding-theme' ? (
              <div
                id={`${subnavId}-branding-theme-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-branding-theme-tab`}
                className={cn(ws.workspaceEditorCardGap, 'flex flex-col gap-5')}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="appearance-theme-card">
                      <WorkspaceSectionHeader
                        id="appearance-theme-card"
                        title="Theme"
                        description="Brand color and overall panel look."
                      />
                      <div className="mt-4 space-y-4">
                        <div className="w-full min-w-0">
                          <FieldRow
                            label="Primary color"
                            htmlFor="appearance-primary-hex"
                            className="min-w-0 gap-1.5"
                            helperText="Accent for buttons, links, and highlights. Pick a swatch or enter hex (#RRGGBB or #RGB). Only hex characters are accepted; invalid colors use the default teal when you leave the field or save."
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                id="appearance-primary-swatch"
                                type="color"
                                aria-label="Primary color picker"
                                value={colorPickerValue}
                                onChange={(e) => patch('primaryColor', normalizePrimaryColor(e.target.value))}
                                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-200 bg-transparent p-0 dark:border-slate-600"
                              />
                              <Input
                                id="appearance-primary-hex"
                                quiet
                                value={primaryColor}
                                onChange={(e) => patch('primaryColor', sanitizePrimaryColorInput(e.target.value))}
                                onBlur={(e) => patch('primaryColor', normalizePrimaryColor(e.target.value))}
                                placeholder={DEFAULT_PRIMARY_HEX}
                                title="Hex color: #RRGGBB or shorthand #RGB"
                                className="min-w-0 max-w-[10rem] flex-1 font-mono text-sm"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="shrink-0 text-slate-600"
                                onClick={() => patch('primaryColor', DEFAULT_PRIMARY_HEX)}
                              >
                                Reset
                              </Button>
                            </div>
                          </FieldRow>
                        </div>
                        <div className={cn(ws.workspaceEditorFieldPairGrid)}>
                          <div className="min-w-0">
                            <FieldRow
                              label="Background"
                              htmlFor="appearance-bg-style"
                              className="min-w-0 gap-1.5"
                              helperText="Light, dark, or follow the visitor’s system setting."
                            >
                              <Select
                                id="appearance-bg-style"
                                quiet
                                value={
                                  chatUi.backgroundStyle === 'dark' || chatUi.backgroundStyle === 'auto'
                                    ? (chatUi.backgroundStyle as string)
                                    : 'light'
                                }
                                onChange={(e) => patch('backgroundStyle', e.target.value)}
                              >
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="auto">Auto (system)</option>
                              </Select>
                            </FieldRow>
                          </div>
                          <div className="min-w-0">
                            <FieldRow
                              label="Shadow"
                              htmlFor="appearance-shadow"
                              className="min-w-0 gap-1.5"
                              helperText="Depth of shadow around the chat panel and launcher."
                            >
                              <Select
                                id="appearance-shadow"
                                quiet
                                value={
                                  ['none', 'low', 'medium', 'high'].includes(String(chatUi.shadowIntensity))
                                    ? String(chatUi.shadowIntensity)
                                    : 'medium'
                                }
                                onChange={(e) => patch('shadowIntensity', e.target.value)}
                              >
                                <option value="none">None</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </Select>
                            </FieldRow>
                          </div>
                        </div>
                      </div>
                    </section>
                  </CardBody>
                </Card>

                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="appearance-surfaces-card">
                      <WorkspaceSectionHeader
                        id="appearance-surfaces-card"
                        title="Surfaces"
                        description="Panel edge, border width, and message bubble shape."
                      />
                      <div className="mt-4 space-y-5">
                        <ToggleRow
                          id="appearance-show-border"
                          label="Show chat panel border"
                          description="Outline around the main chat surface; width is set below when on."
                          checked={getBool(chatUi, 'showChatBorder', true)}
                          onChange={(v) => patch('showChatBorder', v)}
                        />
                        {getBool(chatUi, 'showChatBorder', true) ? (
                          <div className={cn(ws.workspaceEditorFieldPairGrid)}>
                            <div className="min-w-0">
                              <Range
                                id="appearance-panel-border-w"
                                label="Border width"
                                hint={`Outline around the chat panel (${0}–${CHAT_PANEL_BORDER_MAX}px).`}
                                valueSuffix=" px"
                                min={0}
                                max={CHAT_PANEL_BORDER_MAX}
                                step={1}
                                value={Math.round(
                                  clamp(
                                    getNum(chatUi, 'chatPanelBorderWidth', 1),
                                    0,
                                    CHAT_PANEL_BORDER_MAX,
                                  ),
                                )}
                                onValueChange={(v) => patch('chatPanelBorderWidth', v)}
                              />
                            </div>
                            <div className="min-w-0">
                              <Range
                                id="appearance-bubble-radius"
                                label="Message bubble radius"
                                hint={`Corners for bubbles and chips (${BUBBLE_RADIUS_MIN}–${BUBBLE_RADIUS_MAX}px).`}
                                valueSuffix=" px"
                                min={BUBBLE_RADIUS_MIN}
                                max={BUBBLE_RADIUS_MAX}
                                step={1}
                                value={clamp(
                                  Math.round(getNum(chatUi, 'bubbleBorderRadius', 20)),
                                  BUBBLE_RADIUS_MIN,
                                  BUBBLE_RADIUS_MAX,
                                )}
                                onValueChange={(v) => patch('bubbleBorderRadius', v)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <Range
                              id="appearance-bubble-radius"
                              label="Message bubble radius"
                              hint={`Corners for bubbles and suggestion chips (${BUBBLE_RADIUS_MIN}–${BUBBLE_RADIUS_MAX}px).`}
                              valueSuffix=" px"
                              min={BUBBLE_RADIUS_MIN}
                              max={BUBBLE_RADIUS_MAX}
                              step={1}
                              value={clamp(
                                Math.round(getNum(chatUi, 'bubbleBorderRadius', 20)),
                                BUBBLE_RADIUS_MIN,
                                BUBBLE_RADIUS_MAX,
                              )}
                              onValueChange={(v) => patch('bubbleBorderRadius', v)}
                            />
                          </div>
                        )}
                      </div>
                    </section>
                  </CardBody>
                </Card>

                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="appearance-footer-branding-card">
                      <WorkspaceSectionHeader
                        id="appearance-footer-branding-card"
                        title="Footer & branding"
                        description="Attribution and optional privacy line below the chat."
                      />
                      <div className="mt-4 space-y-0">
                        <ToggleRow
                          id="appearance-show-branding"
                          label="Show branding line"
                          description="Attribution or product line at the bottom of the widget."
                          checked={getBool(chatUi, 'showBranding', true)}
                          onChange={(v) => patch('showBranding', v)}
                        />
                        {getBool(chatUi, 'showBranding', true) ? (
                          <div className="border-b border-slate-100 py-3.5">
                            <FieldRow
                              label="Branding text"
                              htmlFor="appearance-branding-msg"
                              className="min-w-0 gap-1.5"
                              helperText={
                                <span className="flex w-full min-w-0 items-start justify-between gap-3">
                                  <span className="min-w-0 flex-1 text-pretty">
                                    One line of attribution below the chat (for example who powers the widget).
                                  </span>
                                  <span className="shrink-0 tabular-nums text-slate-400">
                                    {getStr(chatUi, 'brandingMessage').length}/{CHAT_UI_BRANDING_MESSAGE_MAX_LENGTH}
                                  </span>
                                </span>
                              }
                            >
                              <Textarea
                                id="appearance-branding-msg"
                                quiet
                                rows={2}
                                maxLength={CHAT_UI_BRANDING_MESSAGE_MAX_LENGTH}
                                value={getStr(chatUi, 'brandingMessage')}
                                onChange={(e) =>
                                  patch(
                                    'brandingMessage',
                                    e.target.value.slice(0, CHAT_UI_BRANDING_MESSAGE_MAX_LENGTH),
                                  )
                                }
                                placeholder="Powered by Assistrio"
                              />
                            </FieldRow>
                          </div>
                        ) : null}
                        <ToggleRow
                          id="appearance-show-privacy"
                          label="Show privacy / footer line"
                          description="Second line for legal, privacy, or compliance copy."
                          checked={getBool(chatUi, 'showPrivacyText', true)}
                          onChange={(v) => patch('showPrivacyText', v)}
                        />
                        {getBool(chatUi, 'showPrivacyText', true) ? (
                          <div className="py-3.5">
                            <FieldRow
                              label="Privacy text"
                              htmlFor="appearance-privacy-text"
                              className="min-w-0 gap-1.5"
                              helperText={
                                <span className="flex w-full min-w-0 items-start justify-between gap-3">
                                  <span className="min-w-0 flex-1 text-pretty">
                                    Second line under the branding row—legal, privacy, or compliance copy.
                                  </span>
                                  <span className="shrink-0 tabular-nums text-slate-400">
                                    {getStr(chatUi, 'privacyText').length}/{CHAT_UI_PRIVACY_TEXT_MAX_LENGTH}
                                  </span>
                                </span>
                              }
                            >
                              <Textarea
                                id="appearance-privacy-text"
                                quiet
                                rows={2}
                                maxLength={CHAT_UI_PRIVACY_TEXT_MAX_LENGTH}
                                value={getStr(chatUi, 'privacyText')}
                                onChange={(e) =>
                                  patch(
                                    'privacyText',
                                    e.target.value.slice(0, CHAT_UI_PRIVACY_TEXT_MAX_LENGTH),
                                  )
                                }
                                placeholder="Your conversations are private and secure."
                              />
                            </FieldRow>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'launcher-animation' ? (
              <div
                id={`${subnavId}-launcher-animation-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-launcher-animation-tab`}
                className={cn(ws.workspaceEditorCardGap, 'flex flex-col gap-5')}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="appearance-launcher-place">
                      <WorkspaceSectionHeader
                        id="appearance-launcher-place"
                        title="Placement & icon"
                        description="Where the launcher sits and what it shows."
                      />
                      <div className={cn('mt-4', ws.workspaceEditorFieldPairGrid)}>
                        <div className="min-w-0">
                          <FieldRow
                            label="Position"
                            htmlFor="appearance-launcher-pos"
                            className="min-w-0 gap-1.5"
                            helperText="Which corner of the page hosts the launcher."
                          >
                            <Select
                              id="appearance-launcher-pos"
                              quiet
                              value={chatUi.launcherPosition === 'bottom-left' ? 'bottom-left' : 'bottom-right'}
                              onChange={(e) => patch('launcherPosition', e.target.value)}
                            >
                              <option value="bottom-right">Bottom right</option>
                              <option value="bottom-left">Bottom left</option>
                            </Select>
                          </FieldRow>
                        </div>
                        <div className="min-w-0">
                          <FieldRow
                            label="Icon"
                            htmlFor="appearance-launcher-icon"
                            className="min-w-0 gap-1.5"
                            helperText="Built-in icon, bot avatar, or a custom image URL below."
                          >
                            <Select
                              id="appearance-launcher-icon"
                              quiet
                              value={launcherIcon}
                              onChange={(e) => patch('launcherIcon', e.target.value)}
                            >
                              <option value="default">Default</option>
                              <option value="bot-avatar">Bot avatar</option>
                              <option value="custom">Custom image</option>
                            </Select>
                          </FieldRow>
                        </div>
                        <div className="min-w-0">
                          <FieldRow
                            label="When chat is open"
                            htmlFor="appearance-launcher-open"
                            className="min-w-0 gap-1.5"
                            helperText="Launcher control while the chat panel is open."
                          >
                            <Select
                              id="appearance-launcher-open"
                              quiet
                              value={
                                chatUi.launcherWhenOpen === 'close' || chatUi.launcherWhenOpen === 'same'
                                  ? (chatUi.launcherWhenOpen as string)
                                  : 'chevron-down'
                              }
                              onChange={(e) => patch('launcherWhenOpen', e.target.value)}
                            >
                              <option value="chevron-down">Down arrow</option>
                              <option value="close">Close (X)</option>
                              <option value="same">Same as when closed</option>
                            </Select>
                          </FieldRow>
                        </div>
                      </div>
                    </section>
                  </CardBody>
                </Card>

                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="appearance-launcher-size">
                      <WorkspaceSectionHeader
                        id="appearance-launcher-size"
                        title="Size & avatar"
                        description="Button size, ring, and custom image when applicable."
                      />
                      <div
                        className={cn(
                          'mt-4',
                          showRingControl ? ws.workspaceEditorFieldPairGrid : 'space-y-6',
                        )}
                      >
                        <div className="min-w-0">
                          <Range
                            id="appearance-launcher-size"
                            label="Launcher size"
                            hint={`Button size in pixels (${LAUNCHER_SIZE_MIN}–${LAUNCHER_SIZE_MAX}).`}
                            valueSuffix=" px"
                            min={LAUNCHER_SIZE_MIN}
                            max={LAUNCHER_SIZE_MAX}
                            step={1}
                            value={clamp(
                              Math.round(getNum(chatUi, 'launcherSize', 48)),
                              LAUNCHER_SIZE_MIN,
                              LAUNCHER_SIZE_MAX,
                            )}
                            onValueChange={(v) => patch('launcherSize', v)}
                          />
                        </div>
                        {showRingControl ? (
                          <div className="min-w-0">
                            <Range
                              id="appearance-launcher-ring"
                              label="Ring width"
                              hint="Padding ring around the icon; set to 0 to hide."
                              valueSuffix=" px"
                              min={0}
                              max={RING_WIDTH_MAX}
                              step={1}
                              value={clamp(
                                Math.round(getNum(chatUi, 'launcherAvatarRingWidth', 18)),
                                0,
                                RING_WIDTH_MAX,
                              )}
                              onValueChange={(v) => patch('launcherAvatarRingWidth', v)}
                            />
                          </div>
                        ) : null}
                        {showCustomAvatarUrl ? (
                          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-3">
                            <FieldRow
                              label="Custom image URL"
                              htmlFor="appearance-launcher-url"
                              className="min-w-0 gap-1.5"
                              helperText="HTTPS URL or upload a file (PNG, JPG, WEBP, max 2MB)."
                            >
                              <Input
                                id="appearance-launcher-url"
                                quiet
                                value={getStr(chatUi, 'launcherAvatarUrl')}
                                onChange={(e) =>
                                  patch('launcherAvatarUrl', e.target.value.trim() || undefined)
                                }
                                placeholder="https://…"
                                inputMode="url"
                                autoComplete="off"
                              />
                            </FieldRow>
                            <input
                              ref={launcherFileRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              aria-hidden
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file || file.size > LAUNCHER_IMAGE_MAX_BYTES) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const r = reader.result;
                                  if (typeof r === 'string') patch('launcherAvatarUrl', r);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => launcherFileRef.current?.click()}
                            >
                              Upload image
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </CardBody>
                </Card>

                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="appearance-launching-anim">
                      <WorkspaceSectionHeader
                        id="appearance-launching-anim"
                        title="Launching animation"
                        description="How the chat panel appears when opened."
                      />
                      <div className="mt-4">
                        <FieldRow
                          label="Style"
                          htmlFor="appearance-chat-anim"
                          className="min-w-0 gap-1.5"
                          helperText="How the panel appears when opened; exact motion may vary slightly by embed."
                        >
                          <Select
                            id="appearance-chat-anim"
                            quiet
                            value={
                              ['slide-up-fade', 'fade', 'expand'].includes(String(chatUi.chatOpenAnimation))
                                ? String(chatUi.chatOpenAnimation)
                                : 'slide-up-fade'
                            }
                            onChange={(e) => patch('chatOpenAnimation', e.target.value)}
                          >
                            <option value="slide-up-fade">Slide up + fade</option>
                            <option value="fade">Fade</option>
                            <option value="expand">Expand from launcher</option>
                          </Select>
                        </FieldRow>
                      </div>
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {activeTab === 'composer' ? (
              <div
                id={`${subnavId}-composer-panel`}
                role="tabpanel"
                aria-labelledby={`${subnavId}-composer-tab`}
                className={ws.workspaceEditorCardGap}
              >
                <Card className={cardClass}>
                  <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                    <section className={ws.workspaceEditorCardSection} aria-labelledby="appearance-composer-separate-label">
                      <div className="space-y-0">
                        <ToggleRow
                          id="appearance-composer-separate"
                          label="Separate message input box"
                          description="When on, the composer sits in its own strip below messages. Border options apply in this mode."
                          checked={composerSeparate}
                          onChange={(v) => patch('composerAsSeparateBox', v)}
                        />
                      </div>
                      {!composerSeparate ? (
                        <p className={cn(ws.workspaceEditorControlHint, 'mt-4 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2.5')}>
                          Additional composer styling (border width and color) is available when{' '}
                          <span className="font-medium text-slate-700">Separate message input box</span> is enabled
                          above.
                        </p>
                      ) : (
                        <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
                          <WorkspaceSectionHeader
                            id="appearance-composer-border"
                            title="Input border"
                            description="Styling around the separate message input strip."
                          />
                          <div className={cn('mt-4', ws.workspaceEditorFieldPairGrid)}>
                            <div className="min-w-0">
                              <Range
                                id="appearance-composer-border-w"
                                label="Border width"
                                hint="Stroke around the input strip; 0 uses a thin default (0–6px, step 0.5)."
                                valueSuffix=" px"
                                min={0}
                                max={COMPOSER_BORDER_MAX}
                                step={0.5}
                                value={snapComposerBorderWidth(
                                  getNum(chatUi, 'composerBorderWidth', 1),
                                  COMPOSER_BORDER_MAX,
                                )}
                                onValueChange={(v) =>
                                  patch('composerBorderWidth', snapComposerBorderWidth(v, COMPOSER_BORDER_MAX))
                                }
                              />
                            </div>
                            <div className="min-w-0">
                              <FieldRow
                                label="Border color"
                                htmlFor="appearance-composer-border-color"
                                className="min-w-0 gap-1.5"
                                helperText="Use neutral gray or tie the outline to your primary brand color."
                              >
                                <Select
                                  id="appearance-composer-border-color"
                                  quiet
                                  value={chatUi.composerBorderColor === 'default' ? 'default' : 'primary'}
                                  onChange={(e) => patch('composerBorderColor', e.target.value)}
                                >
                                  <option value="default">Default (neutral)</option>
                                  <option value="primary">Primary color</option>
                                </Select>
                              </FieldRow>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  </CardBody>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
