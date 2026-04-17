import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCustomerBot,
  patchCustomerBot,
  patchCustomerBotAccessSettings,
  postCustomerBotDraftFinalize,
  postCustomerBotRotateAccessKey,
  postCustomerBotRotateSecretKey,
} from '../../api/customerApi';
import { getCustomerApiOrigin } from '../../api/client';
import type { CustomerBotDetail } from '../../api/types';
import { buildFinalizePayloadFromBot } from '../../onboarding/buildFinalizePayload';
import { normalizeCustomerEmbedOrigin, widgetSnippet } from '../../lib/embedOrigin';
import { useBotWorkspace } from './BotWorkspaceContext';

import { ws as styles } from './workspace';
import { SettingsPageLayout, SupportPanel } from '@/layout/workspace-layout';
import { Button, Checkbox, Input, Select, Textarea } from '@/components/ui';

function hasAllowedOriginSaved(bot: CustomerBotDetail): boolean {
  const ao = Array.isArray(bot.allowedOrigins) ? bot.allowedOrigins : [];
  return ao.some((x) => {
    const o = String(x.origin ?? '').trim();
    return o.length > 0 && normalizeCustomerEmbedOrigin(o) != null;
  });
}

type LaunchCheckItem = {
  id: string;
  ok: boolean;
  title: string;
  hint?: string;
};

function buildLaunchChecklist(bot: CustomerBotDetail): LaunchCheckItem[] {
  const published = bot.status === 'published';
  const originOk = hasAllowedOriginSaved(bot);
  const accessOk = Boolean(String(bot.accessKey ?? '').trim());
  const isPrivate = bot.visibility === 'private' || bot.isPublic === false;
  const secretOk = !isPrivate || Boolean(String(bot.secretKey ?? '').trim());

  const items: LaunchCheckItem[] = [
    {
      id: 'published',
      ok: published,
      title: 'Assistant is published',
      hint: published
        ? undefined
        : 'Finish the publish step below (drafts cannot use the live install snippet).',
    },
    {
      id: 'origin',
      ok: originOk,
      title: 'Allowed website origin is saved',
      hint: originOk
        ? undefined
        : 'Add the exact https origin where the widget will run (one site per assistant).',
    },
    {
      id: 'access',
      ok: accessOk,
      title: 'Access key is available',
      hint: accessOk ? undefined : 'Keys appear after publish; rotate if you suspect exposure.',
    },
    {
      id: 'secret',
      ok: secretOk,
      title: isPrivate ? 'Secret key present (private embed)' : 'Public embed — access key only',
      hint:
        isPrivate && !secretOk
          ? 'Private sites need both keys in the snippet. Reveal or rotate the secret if missing.'
          : undefined,
    },
  ];
  return items;
}

export function GoLiveSection() {
  const { bot, botId, reload } = useBotWorkspace();
  const [origin, setOrigin] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [originsSaving, setOriginsSaving] = useState(false);
  const [originsMsg, setOriginsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [accessMode, setAccessMode] = useState<'public' | 'private'>('public');
  const [messageLimitMode, setMessageLimitMode] = useState<'none' | 'fixed_total'>('none');
  const [messageLimitTotal, setMessageLimitTotal] = useState<string>('');
  const [messageLimitUpgradeMessage, setMessageLimitUpgradeMessage] = useState('');
  const [visitorMulti, setVisitorMulti] = useState(false);
  const [visitorMultiMax, setVisitorMultiMax] = useState<string>('');
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessMsg, setAccessMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [publishOrigin, setPublishOrigin] = useState('');
  const [publishLabel, setPublishLabel] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [rotating, setRotating] = useState<'access' | 'secret' | null>(null);
  const [rotateMsg, setRotateMsg] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [accessKeyCopied, setAccessKeyCopied] = useState(false);

  useEffect(() => {
    if (!bot) return;
    const ao = Array.isArray(bot.allowedOrigins) ? bot.allowedOrigins : [];
    const first = ao[0];
    if (first) {
      setOrigin(String(first.origin ?? ''));
      setOriginLabel(typeof first.label === 'string' ? first.label : '');
    } else {
      setOrigin('');
      setOriginLabel('');
    }
    const pub = bot.isPublic !== false && bot.visibility === 'public';
    setAccessMode(pub ? 'public' : 'private');
    setMessageLimitMode(bot.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none');
    setMessageLimitTotal(
      bot.messageLimitTotal != null && Number.isFinite(bot.messageLimitTotal)
        ? String(bot.messageLimitTotal)
        : '',
    );
    setMessageLimitUpgradeMessage(String(bot.messageLimitUpgradeMessage ?? ''));
    setVisitorMulti(bot.visitorMultiChatEnabled === true);
    setVisitorMultiMax(
      bot.visitorMultiChatMax != null && Number.isFinite(bot.visitorMultiChatMax)
        ? String(bot.visitorMultiChatMax)
        : '',
    );
    setPublishOrigin('');
    setPublishLabel('');
  }, [bot]);

  const widgetAssetOrigin = import.meta.env.VITE_WIDGET_ASSET_ORIGIN?.replace(/\/$/, '');

  const runtimeSnippet = useMemo(() => {
    if (!bot || !botId || bot.status !== 'published') return '';
    const apiBase = getCustomerApiOrigin();
    const vis = bot.visibility === 'private' ? 'private' : 'public';
    return widgetSnippet({
      botId: botId,
      apiBaseUrl: apiBase,
      accessKey: String(bot.accessKey ?? ''),
      secretKey: vis === 'private' ? String(bot.secretKey ?? '') : undefined,
      visibility: vis,
      widgetAssetOrigin: widgetAssetOrigin || undefined,
    });
  }, [bot, botId, widgetAssetOrigin]);

  const checklist = useMemo(() => (bot ? buildLaunchChecklist(bot) : []), [bot]);
  const readyCount = useMemo(() => checklist.filter((c) => c.ok).length, [checklist]);
  const allLaunchReady = bot ? readyCount === checklist.length : false;

  const nextStepHint = useMemo(() => {
    if (!bot) return null;
    const firstBad = checklist.find((c) => !c.ok);
    if (!firstBad || allLaunchReady) return null;
    return firstBad.hint ?? `Complete: ${firstBad.title.toLowerCase()}.`;
  }, [bot, checklist, allLaunchReady]);

  if (!bot || !botId) return null;
  const assistantId = botId;

  const isDraft = bot.status === 'draft';
  const clientDraftId = bot.clientDraftId?.trim();
  const isPrivateEmbed = bot.visibility === 'private' || bot.isPublic === false;

  async function saveOrigins(e: React.FormEvent) {
    e.preventDefault();
    setOriginsMsg(null);
    const o = origin.trim();
    if (!o) {
      setOriginsMsg({ type: 'err', text: 'Enter your website origin (https://…).' });
      return;
    }
    const norm = normalizeCustomerEmbedOrigin(o);
    if (!norm) {
      setOriginsMsg({
        type: 'err',
        text: 'Use a valid https URL. Localhost cannot be saved as an allowed embed origin.',
      });
      return;
    }
    setOriginsSaving(true);
    const res = await patchCustomerBot(assistantId, {
      allowedOrigins: [
        {
          origin: norm,
          ...(originLabel.trim() ? { label: originLabel.trim() } : {}),
          isActive: true,
        },
      ],
    });
    setOriginsSaving(false);
    if (!res.ok) {
      setOriginsMsg({ type: 'err', text: res.error });
      return;
    }
    setOriginsMsg({ type: 'ok', text: 'Allowed origin saved. It will apply on your live pages.' });
    await reload();
  }

  async function saveAccess(e: React.FormEvent) {
    e.preventDefault();
    setAccessMsg(null);
    const visibility = accessMode === 'public' ? 'public' : 'private';
    const mode = messageLimitMode;
    let total: number | null = null;
    if (mode === 'fixed_total') {
      const n = Number(messageLimitTotal);
      if (!Number.isFinite(n) || n <= 0) {
        setAccessMsg({ type: 'err', text: 'Enter a positive message limit.' });
        return;
      }
      total = Math.floor(n);
    }
    const rawMax = Number(visitorMultiMax);
    const visitorMultiChatMax =
      visitorMulti && Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : null;

    setAccessSaving(true);
    const res = await patchCustomerBotAccessSettings(assistantId, {
      visibility,
      messageLimitMode: mode,
      messageLimitTotal: mode === 'fixed_total' ? total : null,
      messageLimitUpgradeMessage: messageLimitUpgradeMessage.trim() || null,
      visitorMultiChatEnabled: visitorMulti,
      visitorMultiChatMax: visitorMulti ? visitorMultiChatMax : null,
    });
    setAccessSaving(false);
    if (!res.ok) {
      setAccessMsg({ type: 'err', text: res.error });
      return;
    }
    const patchPublic = await patchCustomerBot(assistantId, {
      isPublic: accessMode === 'public',
      visibility,
    });
    if (!patchPublic.ok) {
      setAccessMsg({ type: 'err', text: patchPublic.error });
      return;
    }
    setAccessMsg({ type: 'ok', text: 'Access settings saved.' });
    await reload();
  }

  async function finalizeDraftPublish(e: React.FormEvent) {
    e.preventDefault();
    setPublishMsg(null);
    if (!clientDraftId) {
      setPublishMsg({ type: 'err', text: 'This draft is missing publish metadata.' });
      return;
    }
    const norm = normalizeCustomerEmbedOrigin(publishOrigin.trim());
    if (!norm) {
      setPublishMsg({
        type: 'err',
        text: 'Enter a valid website origin to publish (https://…, not localhost).',
      });
      return;
    }
    setPublishing(true);
    const patchO = await patchCustomerBot(assistantId, {
      allowedOrigins: [
        {
          origin: norm,
          ...(publishLabel.trim() ? { label: publishLabel.trim() } : {}),
          isActive: true,
        },
      ],
    });
    if (!patchO.ok) {
      setPublishing(false);
      setPublishMsg({ type: 'err', text: patchO.error });
      return;
    }
    const fresh = await getCustomerBot(assistantId);
    if (!fresh.ok) {
      setPublishing(false);
      setPublishMsg({ type: 'err', text: fresh.error });
      return;
    }
    const b = fresh.data.bot as CustomerBotDetail;
    const allowedOrigins = [
      {
        origin: norm,
        ...(publishLabel.trim() ? { label: publishLabel.trim() } : {}),
        isActive: true,
      },
    ];
    const payload = buildFinalizePayloadFromBot(b, {
      allowedOrigins,
      status: 'published',
      isPublic: true,
      visibility: 'public',
    });
    const fin = await postCustomerBotDraftFinalize({ clientDraftId, payload });
    setPublishing(false);
    if (!fin.ok) {
      setPublishMsg({ type: 'err', text: fin.error });
      return;
    }
    setPublishMsg({ type: 'ok', text: 'Published. You can copy the install snippet below when the checklist is green.' });
    await reload();
  }

  async function rotateAccess() {
    setRotateMsg(null);
    setRotating('access');
    const res = await postCustomerBotRotateAccessKey(assistantId);
    setRotating(null);
    if (!res.ok) {
      setRotateMsg(res.error);
      return;
    }
    setRotateMsg('Access key rotated. Copy the new value from the field below.');
    await reload();
  }

  async function rotateSecret() {
    setRotateMsg(null);
    setRotating('secret');
    const res = await postCustomerBotRotateSecretKey(assistantId);
    setRotating(null);
    if (!res.ok) {
      setRotateMsg(res.error);
      return;
    }
    setRotateMsg('Secret key rotated. Reveal and copy it now — it will not be shown again in full.');
    await reload();
  }

  async function copySnippet() {
    if (!runtimeSnippet) return;
    try {
      await navigator.clipboard.writeText(runtimeSnippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  async function copyAccessKey() {
    const v = String(bot?.accessKey ?? '').trim();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setAccessKeyCopied(true);
      setTimeout(() => setAccessKeyCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  return (
    <SettingsPageLayout
      title="Publish"
      description={
        <>
          One allowed HTTPS origin, embed visibility, and a single install snippet before{' '}
          <code className={styles.mono}>&lt;/body&gt;</code>.
        </>
      }
      containerSize="wide"
      support={
        <SupportPanel title="Launch status">
          <p className="m-0 mb-3 text-sm leading-relaxed text-slate-600">
            {allLaunchReady
              ? 'Ready to install — copy the snippet once checks stay green.'
              : `${readyCount} of ${checklist.length} checks passed.`}
          </p>
          <div className={styles.statusChips}>
            {isDraft ? (
              <span className={styles.badgeDraft}>Draft</span>
            ) : (
              <span className={styles.badgePublished}>Published</span>
            )}
            <span className={styles.chip}>{isPrivateEmbed ? 'Private embed' : 'Public embed'}</span>
          </div>
          <ul className={styles.checklist}>
            {checklist.map((item) => (
              <li key={item.id} className={styles.checklistItem}>
                <span
                  className={`${styles.checklistIcon} ${item.ok ? styles.checklistIconOk : styles.checklistIconNo}`}
                  aria-hidden
                >
                  {item.ok ? '\u2713' : '\u25CB'}
                </span>
                <span>
                  {item.title}
                  {item.hint ? <span className={styles.checklistHint}>{item.hint}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {nextStepHint ? <p className={styles.nextSteps}>{nextStepHint}</p> : null}
          <div className={styles.playgroundRow}>
            <span className={styles.goLiveCardLead} style={{ margin: 0 }}>
              Test tone safely:
            </span>
            <Link to={`/bots/${assistantId}/playground/chat`} className={styles.playgroundLink}>
              Open Playground
            </Link>
          </div>
        </SupportPanel>
      }
    >
      <div className={styles.goLiveStack}>
        {isDraft && clientDraftId ? (
          <form className={styles.bannerWarn} onSubmit={(e) => void finalizeDraftPublish(e)} style={{ textAlign: 'left' }}>
            <strong>Publish this assistant</strong>
            <p className={styles.muted} style={{ margin: '0.5rem 0' }}>
              Drafts don’t get an install snippet. Add the live site origin (https, not localhost), then publish — same
              finalize step as onboarding.
            </p>
            {publishMsg?.type === 'err' ? <p className={styles.err}>{publishMsg.text}</p> : null}
            {publishMsg?.type === 'ok' ? <p className={styles.success}>{publishMsg.text}</p> : null}
            <label className={styles.label} htmlFor="go-live-publish-origin">
              Website origin
            </label>
            <Input
              id="go-live-publish-origin"
              quiet
              value={publishOrigin}
              onChange={(e) => setPublishOrigin(e.target.value)}
              placeholder="https://www.example.com"
            />
            <label className={styles.label} htmlFor="go-live-publish-label">
              Label (optional)
            </label>
            <Input id="go-live-publish-label" quiet value={publishLabel} onChange={(e) => setPublishLabel(e.target.value)} />
            <Button type="submit" variant="primary" size="sm" disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish assistant'}
            </Button>
          </form>
        ) : null}

        <section className={styles.goLiveCard}>
          <h3 className={styles.goLiveCardTitle}>1. Allowed origin</h3>
          <p className={styles.goLiveCardLead}>
            Must match your production site (scheme + host, no path). The widget only loads on this origin.
          </p>
          <form onSubmit={(e) => void saveOrigins(e)}>
            {originsMsg?.type === 'ok' ? <p className={styles.success}>{originsMsg.text}</p> : null}
            {originsMsg?.type === 'err' ? <p className={styles.err}>{originsMsg.text}</p> : null}
            <label className={styles.label} htmlFor="go-live-origin">
              Origin (exact match for your live site)
            </label>
            <Input id="go-live-origin" quiet value={origin} onChange={(e) => setOrigin(e.target.value)} />
            <label className={styles.label} htmlFor="go-live-origin-label">
              Label (optional)
            </label>
            <Input id="go-live-origin-label" quiet value={originLabel} onChange={(e) => setOriginLabel(e.target.value)} />
            <Button type="submit" variant="primary" size="sm" disabled={originsSaving}>
              {originsSaving ? 'Saving…' : 'Save origin'}
            </Button>
          </form>
        </section>

        <section className={styles.goLiveCard}>
          <h3 className={styles.goLiveCardTitle}>2. Access &amp; limits</h3>
          <p className={styles.goLiveCardLead}>
            <strong>Public</strong> — snippet includes <code className={styles.mono}>accessKey</code> only.{' '}
            <strong>Private</strong> — snippet also needs <code className={styles.mono}>secretKey</code>; treat both like
            passwords.
          </p>
          <form onSubmit={(e) => void saveAccess(e)}>
            {accessMsg?.type === 'ok' ? <p className={styles.success}>{accessMsg.text}</p> : null}
            {accessMsg?.type === 'err' ? <p className={styles.err}>{accessMsg.text}</p> : null}
            <label className={styles.label} htmlFor="go-live-access-mode">
              Listing / embed mode
            </label>
            <Select
              id="go-live-access-mode"
              quiet
              value={accessMode}
              onChange={(e) => setAccessMode(e.target.value === 'private' ? 'private' : 'public')}
            >
              <option value="public">Public — discoverable; embed uses access key</option>
              <option value="private">Private — embed needs access key + secret</option>
            </Select>
            <label className={styles.label} htmlFor="go-live-msg-limit-mode">
              Total message limit
            </label>
            <Select
              id="go-live-msg-limit-mode"
              quiet
              value={messageLimitMode}
              onChange={(e) => setMessageLimitMode(e.target.value === 'fixed_total' ? 'fixed_total' : 'none')}
            >
              <option value="none">No fixed cap</option>
              <option value="fixed_total">Fixed total messages (per policy)</option>
            </Select>
            {messageLimitMode === 'fixed_total' ? (
              <>
                <label className={styles.label} htmlFor="go-live-msg-limit-total">
                  Max messages
                </label>
                <Input
                  id="go-live-msg-limit-total"
                  quiet
                  value={messageLimitTotal}
                  onChange={(e) => setMessageLimitTotal(e.target.value)}
                  inputMode="numeric"
                />
              </>
            ) : null}
            <label className={styles.label} htmlFor="go-live-limit-msg">
              Limit message (optional)
            </label>
            <Input
              id="go-live-limit-msg"
              quiet
              value={messageLimitUpgradeMessage}
              onChange={(e) => setMessageLimitUpgradeMessage(e.target.value)}
              placeholder="Shown when the cap is reached"
            />
            <label className={styles.check} style={{ marginBottom: '0.75rem' }}>
              <Checkbox checked={visitorMulti} onChange={(e) => setVisitorMulti(e.target.checked)} />
              Allow visitors to keep multiple chat threads in the widget
            </label>
            {visitorMulti ? (
              <>
                <label className={styles.label} htmlFor="go-live-visitor-multi-max">
                  Max concurrent threads per visitor
                </label>
                <Input
                  id="go-live-visitor-multi-max"
                  quiet
                  value={visitorMultiMax}
                  onChange={(e) => setVisitorMultiMax(e.target.value)}
                  inputMode="numeric"
                />
              </>
            ) : null}
            <Button type="submit" variant="primary" size="sm" disabled={accessSaving}>
              {accessSaving ? 'Saving…' : 'Save access settings'}
            </Button>
          </form>
        </section>

        <section className={styles.goLiveCard}>
          <h3 className={styles.goLiveCardTitle}>3. Runtime keys</h3>
          <p className={styles.goLiveCardLead}>
            Rotating invalidates the old key immediately. After rotating, copy the snippet again.
          </p>
          {rotateMsg ? <p className={styles.success}>{rotateMsg}</p> : null}
          <label className={styles.label} htmlFor="go-live-access-key">
            Access key
          </label>
          <Input id="go-live-access-key" quiet readOnly value={String(bot.accessKey ?? '')} />
          <div className={styles.copyRow}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyAccessKey()}
              disabled={!String(bot.accessKey ?? '').trim()}
            >
              Copy access key
            </Button>
            <span className={styles.copyStatus} aria-live="polite">
              {accessKeyCopied ? 'Copied' : '\u00a0'}
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-1.5"
            disabled={rotating !== null}
            onClick={() => void rotateAccess()}
          >
            {rotating === 'access' ? 'Rotating…' : 'Rotate access key'}
          </Button>
          <label className={styles.label} htmlFor="go-live-secret-key" style={{ marginTop: '1rem' }}>
            Secret key
          </label>
          <Input
            id="go-live-secret-key"
            quiet
            readOnly
            revealable={false}
            type={showSecret ? 'text' : 'password'}
            value={String(bot.secretKey ?? '')}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowSecret((s) => !s)}>
              {showSecret ? 'Hide' : 'Reveal'} secret
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={rotating !== null} onClick={() => void rotateSecret()}>
              {rotating === 'secret' ? 'Rotating…' : 'Rotate secret key'}
            </Button>
          </div>
        </section>

        <section className={styles.goLiveCard}>
          <h3 className={styles.goLiveCardTitle}>4. Install snippet</h3>
          {bot.status !== 'published' ? (
            <p className={styles.goLiveCardLead}>
              Publish the assistant first — then the snippet will include your bot id, API URL, and keys.
            </p>
          ) : (
            <>
              <p className={styles.goLiveCardLead}>
                Paste this on pages that match your <strong>allowed origin</strong> (usually just before{' '}
                <code className={styles.mono}>&lt;/body&gt;</code>). Use the same snippet on every page where you want
                the widget.
              </p>
              {!allLaunchReady ? (
                <div className={styles.bannerWarn} style={{ marginBottom: '0.75rem' }}>
                  Some launch checks are still incomplete. The snippet is shown for convenience, but fix the warnings in
                  the checklist above so visitors aren’t blocked at runtime.
                </div>
              ) : null}
              <Textarea
                readOnly
                quiet
                value={runtimeSnippet}
                spellCheck={false}
                rows={12}
                className="min-h-[120px] resize-y font-mono text-[0.75rem] text-slate-600"
              />
              <div className={styles.copyRow}>
                <Button type="button" variant="primary" size="sm" onClick={() => void copySnippet()} disabled={!runtimeSnippet}>
                  {snippetCopied ? 'Copied to clipboard' : 'Copy snippet'}
                </Button>
                <span className={styles.copyStatus} aria-live="polite">
                  {snippetCopied ? 'You can paste into your site HTML.' : '\u00a0'}
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </SettingsPageLayout>
  );
}
