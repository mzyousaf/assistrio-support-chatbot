import { ImageOff } from "lucide-react";

/** Avoid `<img src>` with partial URLs while typing; allow blob, data:image, and http(s). */
export function isSafeImagePreviewSrc(src: string): boolean {
  const t = src.trim();
  if (!t) return false;
  if (t.startsWith("blob:")) return true;
  if (t.startsWith("data:image/")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** URL field: hide data: URLs (from upload) so the user can paste an https URL without fighting the input. */
export function launcherCustomUrlInputValue(url: string | undefined): string {
  if (typeof url !== "string") return "";
  if (url.startsWith("data:")) return "";
  return url;
}

export function BrokenImagePlaceholder({
  size = "md",
  subtitle,
}: {
  size?: "sm" | "md";
  subtitle?: string;
}) {
  const box = size === "sm" ? "h-16 w-16" : "h-[120px] w-[120px]";
  const icon = size === "sm" ? "h-7 w-7" : "h-11 w-11";
  return (
    <div
      className={`flex ${size === "sm" ? "min-h-0" : "min-h-[120px]"} flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-100/90 p-3 dark:border-gray-600 dark:bg-gray-800/60`}
      role="img"
      aria-label={subtitle ?? "Image unavailable"}
    >
      <div
        className={`flex ${box} flex-col items-center justify-center rounded-lg border border-gray-200/80 bg-white/80 dark:border-gray-600 dark:bg-gray-900/40`}
      >
        <ImageOff className={`${icon} shrink-0 text-amber-500/90 dark:text-amber-400/90`} strokeWidth={1.75} aria-hidden />
      </div>
      {subtitle ? (
        <p className="max-w-[14rem] text-center text-[11px] leading-snug text-gray-500 dark:text-gray-400">{subtitle}</p>
      ) : null}
    </div>
  );
}
