import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getBackendHealth } from '@/api/adminSettingsApi';
import { getAdminApiOrigin } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataPageLayout } from '@/layout/workspace-layout';
import { SettingsInfoRow, SettingsStatusBadge } from './settingsUi';

function safeApiBaseUrl(): string {
  try {
    return getAdminApiOrigin();
  } catch (e) {
    return e instanceof Error ? e.message : 'Not configured';
  }
}

export function AdminSystemSettingsPage() {
  const viteMode = import.meta.env.MODE;
  const apiBase = safeApiBaseUrl();
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '—';
  const routePath = typeof window !== 'undefined' ? window.location.pathname : '—';
  const isProd = import.meta.env.PROD;
  const isDev = import.meta.env.DEV;

  const [healthLoading, setHealthLoading] = useState(false);
  const [healthOnline, setHealthOnline] = useState<boolean | null>(null);
  const [healthMs, setHealthMs] = useState<number | null>(null);
  const [healthDetail, setHealthDetail] = useState<string | null>(null);

  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    setHealthDetail(null);
    const res = await getBackendHealth();
    setHealthLoading(false);
    if (res.ok) {
      setHealthOnline(true);
      setHealthMs(res.data.responseTimeMs);
      setHealthDetail(res.data.timestamp ? `Last check: ${res.data.timestamp}` : null);
    } else {
      setHealthOnline(false);
      setHealthMs(null);
      setHealthDetail(res.error);
    }
  }, []);

  useEffect(() => {
    void runHealthCheck();
  }, [runHealthCheck]);

  return (
    <DataPageLayout
      title="System"
      description="Frontend build configuration and backend connectivity. No secrets are shown here."
      embedded
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Frontend</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <SettingsInfoRow label="VITE_API_BASE_URL" value={apiBase} mono />
            <SettingsInfoRow label="App origin" value={appOrigin} mono />
            <SettingsInfoRow label="Current path" value={routePath} mono />
            <SettingsInfoRow label="Vite mode" value={viteMode} />
            <SettingsInfoRow
              label="Environment"
              value={
                <span className="inline-flex flex-wrap gap-2">
                  {isDev ? <SettingsStatusBadge tone="warning">Development</SettingsStatusBadge> : null}
                  {isProd ? <SettingsStatusBadge tone="neutral">Production build</SettingsStatusBadge> : null}
                  {!isDev && !isProd ? <SettingsStatusBadge tone="neutral">Other</SettingsStatusBadge> : null}
                </span>
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Backend health</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void runHealthCheck()}
              disabled={healthLoading}
            >
              <RefreshCw className={healthLoading ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
              {healthLoading ? 'Checking…' : 'Refresh'}
            </Button>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <SettingsInfoRow
              label="Status"
              value={
                healthOnline === null ? (
                  <SettingsStatusBadge tone="neutral">Unknown</SettingsStatusBadge>
                ) : healthOnline ? (
                  <SettingsStatusBadge tone="success">Online</SettingsStatusBadge>
                ) : (
                  <SettingsStatusBadge tone="danger">Offline</SettingsStatusBadge>
                )
              }
            />
            {healthMs != null ? <SettingsInfoRow label="Response time" value={`${healthMs} ms`} /> : null}
            {healthDetail ? (
              <p className="m-0 text-xs text-slate-500">{healthDetail}</p>
            ) : (
              <p className="m-0 text-xs text-slate-500">GET /health on the API origin (unauthenticated).</p>
            )}
          </CardBody>
        </Card>
      </div>
    </DataPageLayout>
  );
}
