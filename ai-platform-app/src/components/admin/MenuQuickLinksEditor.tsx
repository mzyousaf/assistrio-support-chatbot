"use client";

import React, { useState } from "react";

import {
  getQuickLinkIcon,
  QUICK_LINK_ICON_IDS,
  type QuickLinkIconId,
} from "@assistrio/chat-widget/quick-link-icons";

import {
  SettingsActionMenu,
  SettingsCollectionHeader,
  SettingsEmptyCollection,
  SettingsItemList,
  SettingsItemRow,
  SettingsModal,
} from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizeQuickLinkIcon } from "@/lib/quickLinkIconNormalize";
import type { ChatMenuQuickLink } from "@/models/Bot";

const MAX_LINKS = 10;

interface MenuQuickLinksEditorProps {
  value: ChatMenuQuickLink[] | undefined;
  onChange: (next: ChatMenuQuickLink[] | undefined) => void;
}

function normalize(links: ChatMenuQuickLink[] | undefined): ChatMenuQuickLink[] {
  const raw = links ?? [];
  const trimmed = raw
    .slice(0, MAX_LINKS)
    .map((l) => {
      const text = (l.text ?? "").trim();
      const route = (l.route ?? "").trim();
      const icon = normalizeQuickLinkIcon(l.icon);
      return { text, route, ...(icon ? { icon } : {}) };
    })
    .filter((l) => l.text || l.route);
  return trimmed;
}

export default function MenuQuickLinksEditor({ value, onChange }: MenuQuickLinksEditorProps) {
  const links = normalize(value);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ChatMenuQuickLink>({ text: "", route: "" });

  const openAdd = () => {
    setDraft({ text: "", route: "", icon: undefined });
    setEditingIndex(null);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    setDraft({ ...links[index] });
    setEditingIndex(index);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingIndex(null);
  };

  const handleSave = () => {
    const text = draft.text.trim();
    const route = draft.route.trim();
    if (!text && !route) {
      if (editingIndex !== null) {
        const next = links.filter((_, i) => i !== editingIndex);
        onChange(next.length > 0 ? next : undefined);
      }
      closeModal();
      return;
    }
    const icon = normalizeQuickLinkIcon(draft.icon);
    const newLink: ChatMenuQuickLink = {
      text: text || "Link",
      route: route || "#",
      ...(icon ? { icon } : {}),
    };
    if (editingIndex !== null) {
      const next = links.map((l, i) => (i === editingIndex ? newLink : l));
      onChange(next);
    } else if (links.length < MAX_LINKS) {
      onChange([...links, newLink]);
    }
    closeModal();
  };

  const handleDelete = (index: number) => {
    const next = links.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : undefined);
  };

  const canAdd = links.length < MAX_LINKS;

  return (
    <div className="space-y-2">
      <SettingsCollectionHeader
        title="Quick links"
        summary={links.length === 0 ? `Max ${MAX_LINKS}` : `${links.length} of ${MAX_LINKS}`}
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canAdd}
            onClick={openAdd}
          >
            Add link
          </Button>
        }
      />
      {links.length === 0 ? (
        <SettingsEmptyCollection
          title="No quick links"
          description="Add up to 10 links for the chat menu."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={openAdd}>
              Add link
            </Button>
          }
          className="mt-2"
        />
      ) : (
        <SettingsItemList className="mt-2">
          {links.map((link, index) => (
            <SettingsItemRow
              key={index}
              actions={
                <SettingsActionMenu
                  onEdit={() => openEdit(index)}
                  onDelete={() => handleDelete(index)}
                  editLabel="Edit link"
                  deleteLabel="Remove link"
                  showLabels={false}
                />
              }
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                {(() => {
                  const RowIcon = getQuickLinkIcon(link.icon);
                  return (
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      aria-hidden
                    >
                      <RowIcon className="h-4 w-4" strokeWidth={2} />
                    </span>
                  );
                })()}
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {link.text || "—"}
                </span>
                <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400" title={link.route}>
                  {link.route || "—"}
                </span>
              </div>
            </SettingsItemRow>
          ))}
        </SettingsItemList>
      )}

      <SettingsModal
        open={modalOpen}
        onClose={closeModal}
        title={editingIndex !== null ? "Edit link" : "Add link"}
        description="Text, route (path or URL), and optional icon for the header menu."
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSave}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Text</label>
            <Input
              value={draft.text}
              onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="Link text"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Route</label>
            <Input
              value={draft.route}
              onChange={(e) => setDraft((prev) => ({ ...prev, route: e.target.value }))}
              placeholder="/path or https://..."
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-400">Icon</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, icon: undefined }))}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  draft.icon === undefined
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                }`}
              >
                Default
              </button>
            </div>
            <div className="mt-2 grid max-h-[200px] grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-600 sm:grid-cols-8">
              {QUICK_LINK_ICON_IDS.map((id: QuickLinkIconId) => {
                const Icon = getQuickLinkIcon(id);
                const selected = draft.icon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={id}
                    onClick={() => setDraft((prev) => ({ ...prev, icon: id }))}
                    className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                      selected
                        ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
                        : "border-transparent bg-gray-50 text-gray-700 hover:border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsModal>
    </div>
  );
}
