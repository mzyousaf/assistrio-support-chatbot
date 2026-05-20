import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { patchAdminBot } from '@/api/adminApi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import type { BotDetailOutletContext } from './BotDetailLayout';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString();
}

export function BotOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { bot, reload } = useOutletContext<BotDetailOutletContext>();
  const [name, setName] = useState(bot.name ?? '');
  const [description, setDescription] = useState(bot.description ?? '');
  const [status, setStatus] = useState(bot.status === 'published' ? 'published' : 'draft');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeOrigins = (bot.allowedOrigins ?? []).filter((o) => o.isActive !== false && o.origin?.trim());

  useEffect(() => {
    setName(bot.name ?? '');
    setDescription(bot.description ?? '');
    setStatus(bot.status === 'published' ? 'published' : 'draft');
  }, [bot.id, bot.name, bot.description, bot.status]);

  async function handleSave() {
    if (!id) return;
    setSaveError(null);
    setSaving(true);
    const res = await patchAdminBot(id, {
      name: name.trim(),
      description: description.trim(),
      status,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    toast.success('Bot updated');
    await reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Status</p>
            <p className="mt-1 m-0 text-sm font-medium text-slate-900 capitalize">{bot.status || '—'}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Visibility</p>
            <p className="mt-1 m-0 text-sm text-slate-900">
              {bot.visibility === 'private' || bot.isPublic === false ? 'Private' : 'Public'}
            </p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Workspace</p>
            <p className="mt-1 m-0 font-mono text-xs text-slate-700">{bot.workspaceId ?? '—'}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Owner</p>
            <p className="mt-1 m-0 font-mono text-xs text-slate-700">{bot.ownerId ?? '—'}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Slug</p>
            <p className="mt-1 m-0 text-sm text-slate-900">{bot.slug || '—'}</p>
          </div>
          <div>
            <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">Created</p>
            <p className="mt-1 m-0 text-sm text-slate-700">{formatDate(bot.createdAt as string | undefined)}</p>
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
          {status === 'published' && activeOrigins.length === 0 ? (
            <p className="mt-3 mb-0 text-xs text-amber-700">
              Publishing requires at least one active allowed origin on the backend.
            </p>
          ) : null}
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
            <Label htmlFor="bot-name">Name</Label>
            <Input id="bot-name" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="bot-description">Description</Label>
            <Textarea
              id="bot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="bot-status">Status</Label>
            <Select
              id="bot-status"
              value={status}
              onChange={(e) => setStatus(e.target.value === 'published' ? 'published' : 'draft')}
              disabled={saving}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
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
  );
}
