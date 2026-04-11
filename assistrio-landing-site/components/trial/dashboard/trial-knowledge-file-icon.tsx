"use client";

import { FileIcon, defaultStyles } from "react-file-icon";

const stylesMap = defaultStyles as Record<string, Record<string, unknown>>;

function pickExtension(filename: string, mimeType?: string): string {
  if (filename.includes(".")) {
    return filename.split(".").pop()!.toLowerCase().slice(0, 12);
  }
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("wordprocessingml")) return "docx";
  if (m.includes("msword")) return "doc";
  if (m.includes("csv")) return "csv";
  if (m.includes("html")) return "html";
  if (m.includes("markdown")) return "md";
  if (m.includes("plain")) return "txt";
  return "txt";
}

/** Renders a `react-file-icon` style icon from filename / MIME (falls back to generic text). */
export function TrialKnowledgeFileIcon({ filename, mimeType }: { filename: string; mimeType?: string }) {
  const ext = pickExtension(filename, mimeType);
  const style = stylesMap[ext] ?? stylesMap.txt ?? stylesMap.md;
  return (
    <div className="h-8 w-8 shrink-0 [&_svg]:block [&_svg]:h-full [&_svg]:w-full" aria-hidden>
      <FileIcon extension={ext.length > 4 ? ext.slice(0, 4) : ext} {...style} />
    </div>
  );
}
