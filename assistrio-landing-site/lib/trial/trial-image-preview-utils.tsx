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

export function TrialBrokenImagePlaceholder({
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
      className={`flex ${size === "sm" ? "min-h-0" : "min-h-[120px]"} flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/90 p-3`}
      role="img"
      aria-label={subtitle ?? "Image unavailable"}
    >
      <div
        className={`flex ${box} flex-col items-center justify-center rounded-lg border border-slate-200/80 bg-white/90`}
      >
        <ImageOff className={`${icon} shrink-0 text-amber-500/90`} strokeWidth={1.75} aria-hidden />
      </div>
      {subtitle ? <p className="max-w-[14rem] text-center text-[11px] leading-snug text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
