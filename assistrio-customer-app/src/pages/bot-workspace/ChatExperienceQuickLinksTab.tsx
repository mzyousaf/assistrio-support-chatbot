import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, FieldRow, Input, Modal, Switch } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getQuickLinkIcon, getMenuQuickLinksButtonIcon } from '@/lib/quickLinkIcons';
import { normalizeQuickLinkIcon } from '@/lib/quickLinkIconNormalize';
import { BOT_FIELD_MAX, clampStr } from '@/lib/botFieldLimits';
import { isValidQuickLinkUrl } from '@/lib/quickLinkUrlValidation';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { QuickLinkIconPicker } from './QuickLinkIconPicker';
import { ws } from './workspace';

const MAX_QUICK_LINKS = 10;

type MenuQuickLinkRow = { text: string; route: string; icon?: string };

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

type Props = {
  chatUi: Record<string, unknown>;
  patch: (key: string, value: unknown) => void;
  cardClass: string;
};

function getBool(ui: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = ui[key];
  return typeof v === 'boolean' ? v : fallback;
}

/** Same interaction model as Leads Capture when lead capture is off. */
function QuickLinksLockedOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[1] min-h-[10rem] p-4 sm:p-5">
      <div
        className="absolute inset-0 bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]"
        aria-hidden
      />
      <div className="relative z-[1] flex h-full min-h-0 flex-col">
        <div className="h-[25%] min-h-10 shrink-0" aria-hidden />
        <div className="flex w-full shrink-0 justify-center">
          <div
            className="max-w-[18rem] rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 text-center shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05]"
            role="status"
          >
            <div
              className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              aria-hidden
            >
              <Lock className="h-4 w-4" strokeWidth={2} />
            </div>
            <p className="m-0 text-sm font-semibold leading-snug text-slate-900">Quick Links menu is off</p>
            <div className={cn(ws.workspaceEditorControlHint, 'mt-1.5 text-pretty')}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatExperienceQuickLinksTab({ chatUi, patch, cardClass }: Props) {
  const baseId = useId();
  const menuQuickLinks: MenuQuickLinkRow[] = Array.isArray(chatUi.menuQuickLinks)
    ? (chatUi.menuQuickLinks as MenuQuickLinkRow[])
    : [];

  const showQuickLinksUi = getBool(chatUi, 'showMenuQuickLinks', true);

  const [linkModal, setLinkModal] = useState<null | { mode: 'add' } | { mode: 'edit'; index: number }>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const [draftText, setDraftText] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftIcon, setDraftIcon] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<{ text?: string; url?: string }>({});

  const resetDraft = useCallback(() => {
    setDraftText('');
    setDraftUrl('');
    setDraftIcon(undefined);
    setFieldErrors({});
  }, []);

  const openAdd = useCallback(() => {
    resetDraft();
    setLinkModal({ mode: 'add' });
  }, [resetDraft]);

  const openEdit = useCallback(
    (index: number) => {
      const link = menuQuickLinks[index];
      setDraftText(clampStr(link?.text ?? '', BOT_FIELD_MAX.menuQuickLinkText));
      setDraftUrl(clampStr(link?.route ?? '', BOT_FIELD_MAX.menuQuickLinkRoute));
      setDraftIcon(normalizeQuickLinkIcon(link?.icon));
      setFieldErrors({});
      setLinkModal({ mode: 'edit', index });
    },
    [menuQuickLinks],
  );

  useEffect(() => {
    if (!linkModal) resetDraft();
  }, [linkModal, resetDraft]);

  const saveLink = useCallback(() => {
    const text = clampStr(draftText.trim(), BOT_FIELD_MAX.menuQuickLinkText);
    const route = clampStr(draftUrl.trim(), BOT_FIELD_MAX.menuQuickLinkRoute);
    const err: { text?: string; url?: string } = {};
    if (!text) err.text = 'Required';
    if (!route) err.url = 'Enter a URL or path.';
    else if (!isValidQuickLinkUrl(route)) {
      err.url = 'Enter a valid URL (https://…) or a path starting with /.';
    }
    if (Object.keys(err).length) {
      setFieldErrors(err);
      return;
    }
    setFieldErrors({});
    const icon = normalizeQuickLinkIcon(draftIcon);
    const row: MenuQuickLinkRow = { text, route, ...(icon ? { icon } : {}) };

    if (linkModal?.mode === 'add') {
      if (menuQuickLinks.length >= MAX_QUICK_LINKS) return;
      patch('menuQuickLinks', [...menuQuickLinks, row]);
    } else if (linkModal?.mode === 'edit') {
      const i = linkModal.index;
      const next = [...menuQuickLinks];
      next[i] = row;
      patch('menuQuickLinks', next);
    }
    setLinkModal(null);
  }, [draftIcon, draftUrl, draftText, linkModal, menuQuickLinks, patch]);

  const confirmDelete = useCallback(() => {
    if (deleteIndex == null) return;
    const next = [...menuQuickLinks];
    next.splice(deleteIndex, 1);
    patch('menuQuickLinks', next);
    setDeleteIndex(null);
  }, [deleteIndex, menuQuickLinks, patch]);

  const menuIconNormalized = normalizeQuickLinkIcon(chatUi.menuQuickLinksMenuIcon);
  const MenuHeadingIcon = getMenuQuickLinksButtonIcon(menuIconNormalized);
  const ModalIconGlyph = getQuickLinkIcon(normalizeQuickLinkIcon(draftIcon));

  return (
    <>
      <Card className={cardClass}>
        <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
          <section className={ws.workspaceEditorCardSection} aria-labelledby="chat-quick-links-h">
            <WorkspaceSectionHeader
              id="chat-quick-links-h"
              title="Quick Links"
              description="A header control that opens your list of links."
            />
            <div className="mt-4 space-y-0">
              <ToggleRow
                id="chat-show-quick-links"
                label="Show quick links menu"
                description="Adds a header control that opens your links."
                checked={showQuickLinksUi}
                onChange={(v) => patch('showMenuQuickLinks', v)}
              />

              <div className="relative w-full min-w-0">
                <div
                  className={cn(
                    'space-y-4 border-t border-slate-100 pt-4',
                    !showQuickLinksUi && 'pointer-events-none',
                  )}
                  aria-disabled={!showQuickLinksUi || undefined}
                >
                  <FieldRow
                    label="Menu button icon"
                    htmlFor={`${baseId}-menu-icon`}
                    helperText="Icon on the control that opens the quick links list."
                    labelAddon={
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white text-slate-700"
                        aria-hidden
                      >
                        <MenuHeadingIcon className="h-4 w-4" strokeWidth={2} />
                      </span>
                    }
                    labelRowClassName="items-center gap-1.5"
                    className="min-w-0 gap-1.5"
                  >
                    <div className="w-1/2 min-w-0 max-w-full">
                      <QuickLinkIconPicker
                        id={`${baseId}-menu-icon`}
                        ariaLabel="Menu button icon"
                        variant="menu-button"
                        value={menuIconNormalized}
                        onChange={(v) => patch('menuQuickLinksMenuIcon', v)}
                      />
                    </div>
                  </FieldRow>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/30">
                    <div className="border-b border-slate-200/80 px-3 py-3 sm:px-4 sm:py-3.5">
                      <WorkspaceSectionHeader
                        id="chat-quick-links-list-heading"
                        title="Quick Links"
                        titleAddon={
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
                            {menuQuickLinks.length}/{MAX_QUICK_LINKS}
                          </span>
                        }
                        inlineEnd={
                          <Button
                            type="button"
                            variant="outlinePrimary"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            disabled={menuQuickLinks.length >= MAX_QUICK_LINKS}
                            onClick={openAdd}
                          >
                            <Plus size={15} strokeWidth={2} aria-hidden />
                            Add link
                          </Button>
                        }
                        description="Manage links shown in the header menu."
                      />
                    </div>

                    {menuQuickLinks.length === 0 ? (
                      <div className="px-3 py-10 text-center sm:px-4">
                        <p className={cn(ws.workspaceEditorControlHint, 'm-0 text-sm text-slate-600')}>
                          No quick links added
                        </p>
                        <Button
                          type="button"
                          variant="outlinePrimary"
                          size="sm"
                          className="mt-4 gap-1.5"
                          disabled={menuQuickLinks.length >= MAX_QUICK_LINKS}
                          onClick={openAdd}
                        >
                          <Plus size={15} strokeWidth={2} aria-hidden />
                          Add link
                        </Button>
                      </div>
                    ) : (
                      <ul className="m-0 list-none divide-y divide-slate-200/80 p-0" role="list">
                        {menuQuickLinks.map((link, index) => {
                          const RowIcon = getQuickLinkIcon(normalizeQuickLinkIcon(link.icon));
                          const label = (link.text ?? '').trim() || 'Untitled link';
                          const route = (link.route ?? '').trim();
                          return (
                            <li key={index} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                              <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                                aria-hidden
                              >
                                <RowIcon className="h-4 w-4" strokeWidth={2} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="m-0 truncate text-sm font-medium text-slate-900">{label}</p>
                                <p
                                  className="m-0 truncate text-xs leading-snug text-slate-500"
                                  title={route || undefined}
                                >
                                  {route || '—'}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                                  aria-label={`Edit link ${label}`}
                                  onClick={() => openEdit(index)}
                                >
                                  <Pencil size={16} strokeWidth={1.75} aria-hidden />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-[var(--color-danger-text-emphasis)]"
                                  aria-label={`Delete link ${label}`}
                                  onClick={() => setDeleteIndex(index)}
                                >
                                  <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                {!showQuickLinksUi ? (
                  <QuickLinksLockedOverlay>
                    <>
                      Turn on <span className="font-medium text-slate-700">Show quick links menu</span> above to
                      configure the menu icon and links.
                    </>
                  </QuickLinksLockedOverlay>
                ) : null}
              </div>
            </div>
          </section>
        </CardBody>
      </Card>

      <Modal
        open={linkModal !== null}
        onClose={() => setLinkModal(null)}
        title={linkModal?.mode === 'edit' ? 'Edit link' : 'Add link'}
        description="Label, URL, and icon for the header menu."
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" size="lg" onClick={() => setLinkModal(null)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="lg" onClick={() => void saveLink()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldRow
            label="Label"
            htmlFor={`${baseId}-ql-label`}
            required
            error={fieldErrors.text}
            className="min-w-0 gap-1.5"
            labelRowClassName="w-full min-w-0 justify-between gap-2"
            labelAddon={
              <span
                className="shrink-0 text-xs text-slate-500 tabular-nums"
                aria-live="polite"
              >{`${draftText.length}/${BOT_FIELD_MAX.menuQuickLinkText}`}</span>
            }
          >
            <Input
              id={`${baseId}-ql-label`}
              quiet
              value={draftText}
              maxLength={BOT_FIELD_MAX.menuQuickLinkText}
              onChange={(e) => setDraftText(e.target.value.slice(0, BOT_FIELD_MAX.menuQuickLinkText))}
              placeholder="e.g. Contact"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.text)}
            />
          </FieldRow>
          <FieldRow
            label="URL"
            htmlFor={`${baseId}-ql-url`}
            required
            helperText="https://…, mailto:, tel:, or a site path such as /pricing."
            error={fieldErrors.url}
            className="min-w-0 gap-1.5"
          >
            <Input
              id={`${baseId}-ql-url`}
              quiet
              value={draftUrl}
              maxLength={BOT_FIELD_MAX.menuQuickLinkRoute}
              onChange={(e) => setDraftUrl(e.target.value.slice(0, BOT_FIELD_MAX.menuQuickLinkRoute))}
              placeholder="https://example.com or /path"
              autoComplete="off"
              inputMode="url"
              aria-invalid={Boolean(fieldErrors.url)}
            />
          </FieldRow>
          <FieldRow
            label="Icon"
            htmlFor={`${baseId}-ql-icon`}
            labelAddon={
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white text-slate-700"
                aria-hidden
              >
                <ModalIconGlyph className="h-4 w-4" strokeWidth={2} />
              </span>
            }
            labelRowClassName="items-center gap-1.5"
            className="min-w-0 gap-1.5"
          >
            <QuickLinkIconPicker
              id={`${baseId}-ql-icon`}
              ariaLabel="Link icon"
              variant="optional-link"
              value={draftIcon}
              onChange={(v) => setDraftIcon(v)}
            />
          </FieldRow>
        </div>
      </Modal>

      <Modal
        open={deleteIndex !== null}
        onClose={() => setDeleteIndex(null)}
        tone="danger"
        title="Remove quick link?"
        description="This link will be removed from the header menu."
        footer={
          <>
            <Button type="button" variant="secondary" size="lg" onClick={() => setDeleteIndex(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="lg" onClick={() => void confirmDelete()}>
              Remove
            </Button>
          </>
        }
      >
        <p className={cn(ws.workspaceEditorControlHint, 'm-0 text-sm')}>
          {deleteIndex !== null && menuQuickLinks[deleteIndex] ? (
            <>
              <span className="font-medium text-slate-800">
                {(menuQuickLinks[deleteIndex].text ?? '').trim() || 'Untitled link'}
              </span>
              {menuQuickLinks[deleteIndex].route ? (
                <span className="mt-1 block truncate text-slate-600">
                  {menuQuickLinks[deleteIndex].route}
                </span>
              ) : null}
            </>
          ) : null}
        </p>
      </Modal>
    </>
  );
}
