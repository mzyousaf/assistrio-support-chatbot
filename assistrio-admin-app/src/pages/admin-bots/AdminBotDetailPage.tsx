import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getAdminPlatformBot, patchAdminPlatformBot } from '@/api/adminApi';
import type { AdminPlatformBotDetail, PlatformBotType } from '@/api/types';
import { PlatformBotBadges } from '@/components/PlatformBotBadges';
import { PlatformBotPublicUsageCard } from '@/components/PlatformBotPublicUsageCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { InlineLoader } from '@/components/PageLoader';
import { DataPageLayout } from '@/layout/workspace-layout';
import { formatAdminDateTime } from '@/lib/formatAdminDate';

export function AdminBotDetailPage() {
  const { botId } = useParams<{ botId: string }>();
  const [bot, setBot] = useState<AdminPlatformBotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platformBotType, setPlatformBotType] = useState<PlatformBotType>('landing_demo');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    const res = await getAdminPlatformBot(botId);
    setLoading(false);
    if (!res.ok) {
      setBot(null);
      setError(res.error);
      return;
    }
    const data = res.data;
    setBot(data);
    setName(data.name);
    setDescription(data.description ?? '');
    setPlatformBotType((data.platformBotType as PlatformBotType) ?? 'landing_demo');
    setStatus(data.status === 'published' ? 'published' : 'draft');
    setVisibility(data.visibility === 'private' ? 'private' : 'public');
  }, [botId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!botId) return;
    setSaveError(null);
    setSaving(true);
    const res = await patchAdminPlatformBot(botId, {
      name: name.trim(),
      description: description.trim(),
      platformBotType,
      status,
      visibility,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setBot(res.data);
  }

  const activeOrigins = (bot?.allowedOrigins ?? []).filter(
    (o) => o.isActive !== false && o.origin?.trim(),
  );

  if (loading && !bot) {
    return (
      <DataPageLayout embedded title="Admin bot">
        <div className="flex min-h-[200px] items-center justify-center">
          <InlineLoader title="Loading admin bot…" />
        </div>
      </DataPageLayout>
    );
  }

  if (error || !bot) {
    return (
      <DataPageLayout embedded title="Admin bot">
        <p className="mb-4">
          <Link
            to="/admin-bots"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate-600 no-underline hover:text-primary"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to admin bots
          </Link>
        </p>
        <div
          className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]"
          role="alert"
        >
          {error ?? 'Bot not found'}
        </div>
      </DataPageLayout>
    );
  }

  return (
    <DataPageLayout
      embedded
      title={bot.name}
      description={
        <PlatformBotBadges isPlatformBot platformBotType={bot.platformBotType ?? undefined} />
      }
    >
      <p className="mb-6">
        <Link
          to="/admin-bots"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate-600 no-underline hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to admin bots
        </Link>
      </p>

      <div className="flex flex-col gap-6">
        <PlatformBotPublicUsageCard bot={bot} />

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Type</p>
              <p className="mt-1 m-0 text-sm text-slate-900">{bot.platformBotTypeLabel}</p>
            </div>
            <div>
              <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-1 m-0 text-sm font-medium capitalize text-slate-900">{bot.status}</p>
            </div>
            <div>
              <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Visibility</p>
              <p className="mt-1 m-0 text-sm capitalize text-slate-900">{bot.visibility}</p>
            </div>
            <div>
              <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Slug</p>
              <p className="mt-1 m-0 text-sm text-slate-900">{bot.slug || '—'}</p>
            </div>
            <div>
              <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Created</p>
              <p className="mt-1 m-0 text-sm text-slate-700">{formatAdminDateTime(bot.createdAt)}</p>
            </div>
            <div>
              <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Updated</p>
              <p className="mt-1 m-0 text-sm text-slate-700">{formatAdminDateTime(bot.updatedAt)}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allowed origins</CardTitle>
          </CardHeader>
          <CardBody>
            {activeOrigins.length === 0 ? (
              <p className="m-0 text-sm text-slate-500">No active embed origins.</p>
            ) : (
              <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {activeOrigins.map((o) => (
                  <li key={o.origin}>
                    <code className="text-xs">{o.origin}</code>
                    {o.label ? <span className="text-slate-400"> — {o.label}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit basics</CardTitle>
          </CardHeader>
          <CardBody className="flex max-w-xl flex-col gap-4">
            {saveError ? (
              <div
                className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger-text)]"
                role="alert"
              >
                {saveError}
              </div>
            ) : null}
            <div>
              <Label htmlFor="admin-bot-name">Name</Label>
              <Input
                id="admin-bot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="admin-bot-description">Description</Label>
              <Textarea
                id="admin-bot-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="admin-bot-type">Type</Label>
              <Select
                id="admin-bot-type"
                value={platformBotType}
                onChange={(e) => setPlatformBotType(e.target.value as PlatformBotType)}
                disabled={saving}
              >
                <option value="landing_demo">Landing demo</option>
                <option value="showcase">Showcase</option>
                <option value="support">Support</option>
                <option value="internal">Internal</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="admin-bot-status">Status</Label>
              <Select
                id="admin-bot-status"
                value={status}
                onChange={(e) => setStatus(e.target.value === 'published' ? 'published' : 'draft')}
                disabled={saving}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="admin-bot-visibility">Visibility</Label>
              <Select
                id="admin-bot-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value === 'private' ? 'private' : 'public')}
                disabled={saving}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Select>
            </div>
            <div>
              <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </DataPageLayout>
  );
}
