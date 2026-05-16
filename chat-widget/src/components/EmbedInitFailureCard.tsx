import { AlertTriangle, Lock, RefreshCw, SearchX, WifiOff } from "lucide-react";

import type { EmbedInitFailureIconKind } from "../lib/embedInitFailurePresentation";

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function FailureGlyph({ kind }: { kind: EmbedInitFailureIconKind }) {
  const common = "h-7 w-7 shrink-0";
  switch (kind) {
    case "not_found":
      return <SearchX className={cx(common, "text-slate-500")} aria-hidden />;
    case "forbidden":
      return <Lock className={cx(common, "text-amber-600")} aria-hidden />;
    case "network":
      return <WifiOff className={cx(common, "text-slate-500")} aria-hidden />;
    default:
      return <AlertTriangle className={cx(common, "text-amber-600")} aria-hidden />;
  }
}

type Props = {
  icon: EmbedInitFailureIconKind;
  title: string;
  description: string;
  /** Raw error when useful and not redundant with description (non-network). */
  detail?: string | null;
  primaryLabel: string;
  onPrimary: () => void;
};

/** Light card matching the Assistrio dashboard `WorkspaceLoadFailureCard` pattern. */
export function EmbedInitFailureCard({ icon, title, description, detail, primaryLabel, onPrimary }: Props) {
  const d = (detail ?? "").trim();
  const desc = (description ?? "").trim();
  const showDetail = Boolean(d && d !== desc);

  return (
    <div
      className="box-border w-full max-w-[26rem] rounded-2xl border border-slate-200/90 bg-white px-5 py-7 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8 sm:py-8"
      role="alert"
    >
      <div
        className={cx(
          "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full",
          icon === "forbidden" || icon === "generic"
            ? "bg-amber-50 ring-1 ring-amber-100"
            : "bg-slate-50 ring-1 ring-slate-100",
        )}
      >
        <FailureGlyph kind={icon} />
      </div>
      <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{desc}</p>
      {showDetail ? (
        <p className="mx-auto mt-3 max-w-full rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-snug break-words text-slate-500">
          {d}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col items-stretch justify-center sm:items-center">
        <button
          type="button"
          className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 sm:w-auto sm:min-w-[9.5rem]"
          onClick={onPrimary}
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
