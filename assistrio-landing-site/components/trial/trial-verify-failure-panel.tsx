import {
  AlertCircle,
  Clock,
  Link2Off,
  LogOut,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { TrialVerifyFailureActions } from "@/components/trial/trial-verify-failure-actions";
import { trialVerifyReasonCopy, type TrialVerifyReasonKey } from "@/lib/trial/trial-verify-reasons";

function iconForReason(key: TrialVerifyReasonKey) {
  const map: Record<TrialVerifyReasonKey, typeof AlertCircle> = {
    missing: Link2Off,
    invalid: XCircle,
    expired: Clock,
    used: RefreshCw,
    session: LogOut,
    config: Settings,
    error: AlertCircle,
  };
  return map[key];
}

type Props = {
  reasonKey: TrialVerifyReasonKey;
};

export function TrialVerifyFailurePanel({ reasonKey }: Props) {
  const copy = trialVerifyReasonCopy[reasonKey];
  const Icon = iconForReason(reasonKey);

  return (
    <Container className="max-w-lg">
      <div className="flex flex-col items-center rounded-2xl border border-[var(--border-default)] bg-white px-6 py-10 text-center shadow-[var(--shadow-sm)] sm:px-10 sm:py-12">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/90"
          aria-hidden
        >
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <p className="mt-6 text-eyebrow">Assistrio</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug text-slate-900">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">{copy.body}</p>

        <TrialVerifyFailureActions reasonKey={reasonKey} />

        <p className="mt-8 max-w-md border-t border-[var(--border-default)] pt-6 text-xs leading-relaxed text-[var(--foreground-muted)]">
          Need help? Use the contact option on the homepage, or open the trial flow and enter your email again — we&apos;ll
          send another secure link.
        </p>
      </div>
    </Container>
  );
}
