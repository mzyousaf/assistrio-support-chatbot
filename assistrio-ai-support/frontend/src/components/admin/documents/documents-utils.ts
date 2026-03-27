export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_EXTENSIONS = new Set(["docx", "pdf", "doc", "md", "txt"]);

export function formatSize(bytes?: number): string {
  if (typeof bytes !== "number") return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts[parts.length - 1] || "").toLowerCase() : "";
}

/**
 * Gets file type (extension) from a string that can be a filename or a URL.
 * Examples: "report.pdf" -> "pdf", "https://example.com/docs/file.docx" -> "docx"
 */
export function getFileTypeFromText(text: string | undefined): string {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const pathname = new URL(trimmed).pathname || "";
      const segment = pathname.split("/").filter(Boolean).pop() || "";
      return getExtension(segment);
    }
  } catch {
    // not a valid URL, fall through to filename logic
  }
  return getExtension(trimmed);
}

export function truncateMessage(input?: string, max = 120): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export type DocumentStatus = "queued" | "processing" | "ready" | "failed";

export function getStatusMeta(status?: DocumentStatus): { label: string; className: string } {
  if (status === "processing") {
    return {
      label: "Processing",
      className:
        "border-blue-300 dark:border-blue-600 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-medium",
    };
  }
  if (status === "ready") {
    return {
      label: "Ready",
      className:
        "border-emerald-300 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium",
    };
  }
  if (status === "failed") {
    return {
      label: "Failed",
      className:
        "border-red-300 dark:border-red-600 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 font-medium",
    };
  }
  return {
    label: "Queued",
    className:
      "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 font-medium",
  };
}

export function isLegacyDocWithoutText(hasText?: boolean, fileName?: string, fileType?: string): boolean {
  const ext = fileName ? getExtension(fileName) : "";
  return !hasText && (ext === "doc" || fileType === "application/msword");
}
