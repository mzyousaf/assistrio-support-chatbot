"use client";

import React, { useState } from "react";

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
import type { ChatMenuQuickLink } from "@/models/Bot";

const MAX_LINKS = 3;

interface MenuQuickLinksEditorProps {
  value: ChatMenuQuickLink[] | undefined;
  onChange: (next: ChatMenuQuickLink[] | undefined) => void;
}

function normalize(links: ChatMenuQuickLink[] | undefined): ChatMenuQuickLink[] {
  const raw = links ?? [];
  const trimmed = raw
    .slice(0, MAX_LINKS)
    .map((l) => ({ text: (l.text ?? "").trim(), route: (l.route ?? "").trim() }))
    .filter((l) => l.text || l.route);
  return trimmed;
}

export default function MenuQuickLinksEditor({ value, onChange }: MenuQuickLinksEditorProps) {
  const links = normalize(value);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ChatMenuQuickLink>({ text: "", route: "" });

  const openAdd = () => {
    setDraft({ text: "", route: "" });
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
    const newLink: ChatMenuQuickLink = { text: text || "Link", route: route || "#" };
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
    <>
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
          description="Add up to 3 links for the chat menu. Maximum 3 links allowed."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={openAdd}>
              Add link
            </Button>
          }
          className="mt-3"
        />
      ) : (
        <SettingsItemList className="mt-3">
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
              <div className="flex min-w-0 flex-1 items-baseline gap-2 sm:gap-3">
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
        description="Text and route (path or URL) for the menu item."
        maxWidthClass="max-w-sm"
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
        </div>
      </SettingsModal>
    </>
  );
}
