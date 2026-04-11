import { Info } from "lucide-react";

type Props = {
  content: string;
  className?: string;
};

/** Lightweight help: native tooltip + accessible label (no portal). */
export function TrialSettingsInfoTooltip({ content, className = "" }: Props) {
  return (
    <span
      className={`inline-flex cursor-help text-slate-400 hover:text-slate-500 ${className}`.trim()}
      title={content}
      tabIndex={0}
      role="img"
      aria-label={content}
    >
      <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
    </span>
  );
}
