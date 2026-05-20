import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminPlatformBotDetail } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  buildPlatformBotPublicApiUrl,
  buildPlatformBotPublicListApiUrl,
  evaluatePlatformBotPublicReadiness,
} from '@/lib/platformBotPublicUsage';
import { cn } from '@/lib/utils';

type Props = {
  bot: AdminPlatformBotDetail;
};

async function copyText(label: string, value: string) {
  if (!value.trim()) {
    toast.error(`Nothing to copy for ${label}`);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label}`);
  }
}

export function PlatformBotPublicUsageCard({ bot }: Props) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const { checks, isReady } = evaluatePlatformBotPublicReadiness(bot);
  const publicUrl = buildPlatformBotPublicApiUrl(bot);
  const listUrl = buildPlatformBotPublicListApiUrl(bot.platformBotType ?? undefined);

  async function handlePreviewPublic() {
    setPreviewLoading(true);
    const { getPublicPlatformBot } = await import('@/api/publicApi');
    const res = await getPublicPlatformBot(bot.slug?.trim() || bot._id);
    setPreviewLoading(false);
    if (!res.ok) {
      toast.error(res.error || 'Public API returned an error');
      return;
    }
    toast.success(`Public API OK: ${res.data.bot.name}`);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Public usage</CardTitle>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold',
            isReady ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800',
          )}
        >
          {isReady ? 'Public ready' : 'Not public ready'}
        </span>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <dl className="m-0 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Type</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{bot.platformBotTypeLabel}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Status</dt>
            <dd className="mt-0.5 font-medium capitalize text-slate-900">{bot.status}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Visibility</dt>
            <dd className="mt-0.5 font-medium capitalize text-slate-900">{bot.visibility}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Public API</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">{publicUrl}</dd>
          </div>
        </dl>

        <div>
          <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-400">
            Readiness
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2 text-[0.8125rem] text-slate-700">
                {check.ok ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
                )}
                <span>
                  {check.label}
                  {check.detail ? (
                    <span className="mt-0.5 block font-mono text-[0.6875rem] text-slate-500">{check.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void copyText('Public API URL', publicUrl)}>
            <Copy size={14} className="mr-1.5" aria-hidden />
            Copy public API URL
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void copyText('List API URL', listUrl)}
          >
            <Copy size={14} className="mr-1.5" aria-hidden />
            Copy list URL
          </Button>
          {bot.accessKey ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyText('Access key', bot.accessKey!)}
            >
              <Copy size={14} className="mr-1.5" aria-hidden />
              Copy access key
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={previewLoading}
            onClick={() => void handlePreviewPublic()}
          >
            {previewLoading ? 'Checking…' : 'Test public API'}
          </Button>
          <Link
            to={`/bots/${bot._id}/analytics`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ui-border)] bg-white px-3 py-1.5 text-[0.8125rem] font-semibold text-slate-700 no-underline transition-colors hover:bg-[var(--hover-soft)]"
          >
            Bot analytics
          </Link>
          <Link
            to={`/bots/${bot._id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ui-border)] bg-white px-3 py-1.5 text-[0.8125rem] font-semibold text-slate-700 no-underline transition-colors hover:bg-[var(--hover-soft)]"
          >
            Open full bot editor
            <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
