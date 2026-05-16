import React, { useEffect, useState } from "react";
import { ExternalLink, Paperclip, Trash2, Upload } from "lucide-react";
import type { ChatUIMessageAttachment } from "./types";
import { WidgetChatFileIcon } from "../../lib/widgetFileIcon";
import { cx } from "./utils";

function formatKb(size: number): string {
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

const BackIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

function ComposerImageTopStrip({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block min-w-0 bg-black/5 dark:bg-black/20">
      <img src={url} alt="" className="max-h-32 w-full object-cover" />
    </a>
  );
}

/** Single tile layout: image strip (if any) + row with optional type glyph, name/size, trailing action — used for composer + sent messages. */
function AttachmentTile({
  dark,
  mime,
  top,
  name,
  sizeLine,
  trailing,
}: {
  dark: boolean;
  mime: string;
  top: React.ReactNode;
  name: string;
  sizeLine: string | null;
  trailing: React.ReactNode;
}) {
  return (
    <div
      role="listitem"
      className={cx(
        "overflow-hidden rounded-xl border shadow-sm transition-colors",
        dark
          ? "border-gray-600/55 bg-gray-800/45 shadow-black/15 hover:border-gray-500/65"
          : "border-gray-200/95 bg-white shadow-gray-200/90 hover:border-gray-300",
      )}
    >
      {top}
      <div className="flex min-w-0 items-center gap-2 p-2">
        <WidgetChatFileIcon fileName={name} mimeType={mime} dark={dark} />
        <div className="min-w-0 flex-1">
          <p
            className={cx(
              "truncate text-xs font-medium leading-snug",
              dark ? "text-gray-100" : "text-gray-900",
            )}
            title={name}
          >
            {name}
          </p>
          {sizeLine ? (
            <p className={cx("mt-0.5 text-[10px] font-medium", dark ? "text-gray-500" : "text-gray-500")}>{sizeLine}</p>
          ) : null}
        </div>
        {trailing}
      </div>
    </div>
  );
}

export interface ChatAttachmentsScreenComposerProps {
  dark?: boolean;
  accentColor?: string;
  title: string;
  backLabel: string;
  uploadLabel: string;
  removeLabel: string;
  mode: "composer";
  composerItems: Array<{ id: string; file: File }>;
  onBack: () => void;
  onRemove: (id: string) => void;
  onUploadMore: () => void;
  /** When true, Upload is disabled (e.g. max files per message). */
  uploadDisabled?: boolean;
  uploadDisabledTitle?: string;
}

export interface ChatAttachmentsScreenMessageProps {
  dark?: boolean;
  accentColor?: string;
  title: string;
  backLabel: string;
  mode: "message";
  messageAttachments: ChatUIMessageAttachment[];
  onBack: () => void;
}

export type ChatAttachmentsScreenProps = ChatAttachmentsScreenComposerProps | ChatAttachmentsScreenMessageProps;

export function ChatAttachmentsScreen(props: ChatAttachmentsScreenProps) {
  const { dark = true, accentColor = "#6366f1", title, backLabel, onBack, mode } = props;

  return (
    <>
      <header
        className={cx(
          "relative flex-shrink-0 border-b px-4 py-3",
          dark ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-gray-50",
        )}
        aria-label={title}
      >
        <button
          type="button"
          onClick={onBack}
          className={cx(
            "absolute left-2 top-1/2 z-10 flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-lg transition-colors",
            dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800",
          )}
          aria-label={backLabel}
          title={backLabel}
        >
          <BackIcon />
        </button>
        <div className="mx-auto flex min-w-0 max-w-full flex-col items-center gap-0.5 px-10 text-center">
          <div className="flex min-w-0 max-w-full items-center justify-center gap-2.5">
            <div
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full shadow-sm"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            >
              <Paperclip className="h-[18px] w-[18px] text-white" strokeWidth={2} />
            </div>
            <h2
              className={cx(
                "min-w-0 max-w-full truncate text-sm font-medium tracking-tight",
                dark ? "text-gray-200" : "text-gray-800",
              )}
            >
              {title}
            </h2>
          </div>
        </div>
        {mode === "composer" ? (
          <button
            type="button"
            onClick={props.onUploadMore}
            disabled={props.uploadDisabled}
            title={props.uploadDisabled ? props.uploadDisabledTitle : undefined}
            className={cx(
              "absolute right-2 top-1/2 z-10 -translate-y-1/2 inline-flex max-w-[min(42%,9.5rem)] items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              dark ? "focus-visible:ring-offset-gray-900" : "focus-visible:ring-offset-white",
              props.uploadDisabled ? "cursor-default opacity-45 hover:opacity-45" : "hover:opacity-92",
            )}
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 1px 2px ${accentColor}44`,
            }}
            aria-label={props.uploadLabel}
            aria-disabled={props.uploadDisabled || undefined}
          >
            <Upload className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            <span className="min-w-0 truncate">{props.uploadLabel}</span>
          </button>
        ) : (
          <span className="pointer-events-none absolute right-2 top-1/2 h-[30px] w-[30px] -translate-y-1/2" aria-hidden />
        )}
      </header>
      <div
        className={cx(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5",
          dark ? "bg-gray-900" : "bg-white",
        )}
        role="list"
        aria-label={title}
      >
        {mode === "composer"
          ? props.composerItems.map((item) => {
              const { file, id } = item;
              const isImage = /^image\//i.test(file.type);
              const sizeLine = file.size > 0 ? formatKb(file.size) : null;
              return (
                <AttachmentTile
                  key={id}
                  dark={dark}
                  mime={file.type || ""}
                  top={isImage ? <ComposerImageTopStrip file={file} /> : null}
                  name={file.name}
                  sizeLine={sizeLine}
                  trailing={
                    <button
                      type="button"
                      onClick={() => props.onRemove(id)}
                      className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        dark
                          ? "text-gray-400 hover:bg-red-500/15 hover:text-red-300"
                          : "text-gray-500 hover:bg-red-50 hover:text-red-600",
                      )}
                      aria-label={`${props.removeLabel}: ${file.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </button>
                  }
                />
              );
            })
          : props.messageAttachments.map((a, i) => {
              const isImage = /^image\//i.test(a.mimeType);
              const sizeLine =
                typeof a.size === "number" && a.size > 0 ? formatKb(a.size) : null;
              return (
                <AttachmentTile
                  key={`${a.url}-${i}`}
                  dark={dark}
                  mime={a.mimeType}
                  top={
                    isImage ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block min-w-0 bg-black/5 dark:bg-black/20"
                      >
                        <img src={a.url} alt="" className="max-h-32 w-full object-cover" />
                      </a>
                    ) : null
                  }
                  name={a.name}
                  sizeLine={sizeLine}
                  trailing={
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        dark
                          ? "text-gray-400 hover:bg-gray-700/80 hover:text-indigo-300"
                          : "text-gray-500 hover:bg-gray-100 hover:text-indigo-600",
                      )}
                      aria-label={`Open ${a.name}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                    </a>
                  }
                />
              );
            })}
      </div>
    </>
  );
}
