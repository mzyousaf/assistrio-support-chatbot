"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { SettingsModal } from "@/components/admin/settings/SettingsModal";
import { File, FileCode, FileText, Loader2, Play, RotateCcw, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatSize, formatDate, getStatusMeta, getFileTypeFromText, isLegacyDocWithoutText, truncateMessage } from "./documents-utils";
import type { DocumentStatus } from "./documents-utils";

export interface DocumentRow {
  _id: string;
  title: string;
  fileName?: string;
  fileSize?: number;
  status?: DocumentStatus;
  error?: string;
  textLength?: number;
  hasText?: boolean;
  fileType?: string;
  url?: string;
  createdAt?: string;
  active?: boolean;
}

const QUEUED_FORCE_PROCESS_MS = 3 * 60 * 1000; // 3 minutes

const FILE_TYPE_STYLES: Record<string, { Icon: typeof FileText; iconClass: string }> = {
  doc: { Icon: FileText, iconClass: "text-blue-600 dark:text-blue-400" },
  docx: { Icon: FileText, iconClass: "text-blue-600 dark:text-blue-400" },
  txt: { Icon: FileText, iconClass: "text-slate-500 dark:text-slate-400" },
  md: { Icon: FileCode, iconClass: "text-amber-600 dark:text-amber-400" },
  pdf: { Icon: File, iconClass: "text-red-600 dark:text-red-400" },
};

function getFileIconFromType(fileType: string) {
  const style = FILE_TYPE_STYLES[fileType];
  if (style) return style;
  return { Icon: File, iconClass: "text-gray-500 dark:text-gray-400" };
}

interface DocumentsTableProps {
  botId: string;
  items: DocumentRow[];
  selectedDocIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  deletingIds: Set<string>;
  retryingId: string | null;
  forceProcessingId: string | null;
  isRetryingAll: boolean;
  bulkDeleting?: boolean;
  togglingActiveId?: string | null;
  onRetry: (docId: string) => void;
  onDelete: (docId: string) => void;
  onForceProcess: (docId: string) => void;
  onBulkDelete?: (docIds: string[]) => void;
  onSetActive?: (docId: string, active: boolean) => void;
}

export function DocumentsTable({
  botId,
  items,
  selectedDocIds = [],
  onSelectionChange,
  deletingIds,
  retryingId,
  forceProcessingId,
  isRetryingAll,
  bulkDeleting = false,
  togglingActiveId = null,
  onRetry,
  onDelete,
  onForceProcess,
  onBulkDelete,
  onSetActive,
}: DocumentsTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "retry" | "forceProcess" | "bulkDelete";
    doc?: DocumentRow;
    docIds?: string[];
  } | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const itemIds = items.map((d) => d._id);
  const allOnPageSelected =
    itemIds.length > 0 && selectedDocIds.length > 0 && itemIds.every((id) => selectedDocIds.includes(id));
  const someSelected = selectedDocIds.length > 0;

  function toggleRowSelection(docId: string) {
    if (!onSelectionChange) return;
    if (selectedDocIds.includes(docId)) {
      onSelectionChange(selectedDocIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedDocIds, docId]);
    }
  }

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    if (allOnPageSelected) {
      const removeSet = new Set(itemIds);
      onSelectionChange(selectedDocIds.filter((id) => !removeSet.has(id)));
    } else {
      const addSet = new Set(itemIds);
      onSelectionChange([...new Set([...selectedDocIds, ...addSet])]);
    }
  }

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someSelected && !allOnPageSelected;
  }, [someSelected, allOnPageSelected]);

  async function handleDownload(doc: DocumentRow) {
    if (!botId || downloadingId) return;
    const hasValidUrl = doc.url && (doc.url.startsWith("http://") || doc.url.startsWith("https://"));
    if (hasValidUrl) {
      window.open(doc.url!, "_blank", "noopener,noreferrer");
      return;
    }
    setDownloadingId(doc._id);
    try {
      const res = await apiFetch(`/api/super-admin/bots/${botId}/documents/${doc._id}/download-url`);
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) return;
      window.open(data.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      {someSelected && onBulkDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-3 py-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {selectedDocIds.length} selected
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={bulkDeleting}
            onClick={() => setConfirmAction({ type: "bulkDelete", docIds: [...selectedDocIds] })}
            className="text-xs"
          >
            {bulkDeleting ? "Deleting…" : "Delete selected"}
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              {onSelectionChange ? (
                <th className="w-10 px-2 py-2">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    aria-label="Select all on page"
                  />
                </th>
              ) : null}
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                File
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                File type
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Size
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Status
              </th>
              {onSetActive ? (
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Active
                </th>
              ) : null}
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Added
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 min-w-[7rem]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300 text-xs">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={onSelectionChange && onSetActive ? 8 : onSelectionChange || onSetActive ? 7 : 6}
                  className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400"
                >
                  No documents for this status.
                </td>
              </tr>
            ) : (
            items.map((doc, index) => {
              const statusMeta = getStatusMeta(doc.status);
              const isFailed = doc.status === "failed";
              const legacyWarning = isLegacyDocWithoutText(doc.hasText, doc.fileName, doc.fileType);
              const rowBg =
                isFailed
                  ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100/80 dark:hover:bg-red-900/30"
                  : index % 2 === 0
                    ? "bg-white dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    : "bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/60";
              const ext = getFileTypeFromText(doc.url ?? doc.fileName ?? doc.title);
              const { Icon: FileIcon, iconClass } = getFileIconFromType(ext);
              const isDownloading = downloadingId === doc._id;
              const queuedForMs = doc.createdAt ? Date.now() - new Date(doc.createdAt).getTime() : 0;
              const showForceProcess =
                doc.status === "queued" && queuedForMs >= QUEUED_FORCE_PROCESS_MS;
              const isReady = doc.status === "ready";
              const isActive = doc.active !== false;
              return (
                <tr key={doc._id} className={rowBg}>
                  {onSelectionChange ? (
                    <td className="w-10 px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc._id)}
                        onChange={() => toggleRowSelection(doc._id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Select ${doc.title}`}
                      />
                    </td>
                  ) : null}
                  <td
                    className={`px-3 py-2 font-medium text-gray-900 dark:text-gray-100 ${isFailed ? "border-l-2 border-red-400 dark:border-red-500" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleDownload(doc)}
                      disabled={isDownloading}
                      className="inline-flex min-w-0 max-w-full items-center gap-2 rounded text-left transition hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                      title="Download file"
                    >
                      <FileIcon className={`h-3 w-3 shrink-0 ${iconClass}`} aria-hidden />
                      <span className="min-w-0 truncate">{doc.title}</span>
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" aria-hidden />
                      ) : null}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300 font-medium">
                    {ext ? ext.toUpperCase() : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">
                    {formatSize(doc.fileSize)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                      {legacyWarning ? (
                        <span className="inline-flex w-fit rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          DOC needs conversion
                        </span>
                      ) : null}
                      {isFailed && doc.error ? (
                        <p
                          className="mt-0.5 rounded bg-red-100/80 px-1.5 py-1 text-[11px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200"
                          title={doc.error}
                        >
                          {truncateMessage(doc.error, 80)}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  {onSetActive ? (
                    <td className="px-3 py-2">
                      {isReady ? (
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked) => onSetActive(doc._id, checked)}
                          disabled={togglingActiveId === doc._id}
                          aria-label={isActive ? "Deactivate" : "Activate"}
                        />
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">
                    {formatDate(doc.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5">
                      {showForceProcess ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={forceProcessingId === doc._id}
                          className="h-8 w-8 p-0 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
                          onClick={() => setConfirmAction({ type: "forceProcess", doc })}
                          title="Force process"
                          aria-label="Force process"
                        >
                          {forceProcessingId === doc._id ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                          ) : (
                            <Play className="h-4 w-4 shrink-0" aria-hidden />
                          )}
                        </Button>
                      ) : null}
                      {isFailed ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={retryingId === doc._id || isRetryingAll}
                          className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
                          onClick={() => setConfirmAction({ type: "retry", doc })}
                          title="Retry ingestion"
                          aria-label="Retry ingestion"
                        >
                          {retryingId === doc._id ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                          ) : (
                            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                          )}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deletingIds.has(doc._id)}
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        onClick={() => setConfirmAction({ type: "delete", doc })}
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        {deletingIds.has(doc._id) ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      <SettingsModal
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.type === "bulkDelete"
            ? "Delete selected documents?"
            : confirmAction?.type === "delete"
              ? "Delete document?"
              : confirmAction?.type === "retry"
                ? "Retry ingestion?"
                : "Force process?"
        }
        description={
          confirmAction?.type === "bulkDelete"
            ? `${confirmAction.docIds?.length ?? 0} document(s) will be permanently deleted. This cannot be undone.`
            : confirmAction?.doc
              ? `"${confirmAction.doc.title}"${confirmAction.type === "delete" ? " will be permanently deleted. This cannot be undone." : confirmAction.type === "retry" ? " — retry ingestion for this document?" : " — start processing this file now?"}`
              : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          confirmAction ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirmAction.type === "delete" || confirmAction.type === "bulkDelete" ? "destructive" : "primary"}
                size="sm"
                disabled={confirmAction.type === "bulkDelete" && bulkDeleting}
                onClick={() => {
                  if (!confirmAction) return;
                  const { type, doc, docIds } = confirmAction;
                  if (type === "bulkDelete" && docIds?.length && onBulkDelete) {
                    onBulkDelete(docIds);
                  } else if (type === "delete" && doc) {
                    onDelete(doc._id);
                  } else if (type === "retry" && doc) {
                    onRetry(doc._id);
                  } else if (type === "forceProcess" && doc) {
                    onForceProcess(doc._id);
                  }
                  setConfirmAction(null);
                }}
              >
                {confirmAction.type === "bulkDelete"
                  ? bulkDeleting
                    ? "Deleting…"
                    : "Delete selected"
                  : confirmAction.type === "delete"
                    ? "Delete"
                    : confirmAction.type === "retry"
                      ? "Retry"
                      : "Process"}
              </Button>
            </>
          ) : null
        }
      >
        {confirmAction ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {confirmAction.type === "bulkDelete" &&
              "All knowledge base content and data related to the selected documents will be removed."}
            {confirmAction.type === "delete" &&
              "All knowledge base content and data related to this document will be removed."}
            {confirmAction.type === "retry" && "The document will be re-queued for ingestion."}
            {confirmAction.type === "forceProcess" && "The document will be sent for processing."}
          </p>
        ) : null}
      </SettingsModal>
    </div>
  );
}
