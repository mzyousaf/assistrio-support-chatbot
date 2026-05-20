import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { InlineLoader } from '@/components/PageLoader';
import { WorkspaceLoadFailureCard } from '@/components/WorkspaceLoadFailureCard';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAdminAuth } from '@/auth/AdminAuthContext';
import { DataPageLayout } from '@/layout/workspace-layout';
import { SettingsInfoRow, SettingsStatusBadge } from './settingsUi';

export function AdminAccountSettingsPage() {
  const { admin, status, bootstrapError, refresh, logout, logoutInFlight, logoutError } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    const ok = await logout();
    if (ok) navigate('/login', { replace: true });
  }, [logout, navigate]);

  if (status === 'loading') {
    return (
      <DataPageLayout title="Account" description="Your admin session and staff profile." embedded>
        <div className="flex min-h-[200px] items-center justify-center">
          <InlineLoader title="Loading account…" />
        </div>
      </DataPageLayout>
    );
  }

  if (status !== 'authenticated' || !admin) {
    return (
      <DataPageLayout title="Account" description="Your admin session and staff profile." embedded>
        <WorkspaceLoadFailureCard
          icon="generic"
          title="Account unavailable"
          description={bootstrapError || 'Could not load your admin account.'}
          onPrimary={() => void refresh()}
          primaryLabel="Retry"
          secondary={null}
        />
      </DataPageLayout>
    );
  }

  return (
    <DataPageLayout
      title="Account"
      description="Your admin session and staff profile. Profile editing is not available yet."
      embedded
      actions={
        <Button type="button" variant="secondary" size="sm" onClick={() => void handleLogout()} disabled={logoutInFlight}>
          {logoutInFlight ? 'Signing out…' : 'Log out'}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {logoutError ? (
          <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {logoutError}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <SettingsInfoRow label="Session type" value={<SettingsStatusBadge tone="neutral">Admin</SettingsStatusBadge>} />
            <SettingsInfoRow label="Email" value={admin.email} />
            <SettingsInfoRow label="Role" value={<SettingsStatusBadge tone="success">{admin.role}</SettingsStatusBadge>} />
            <SettingsInfoRow label="User ID" value={admin.id} mono />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
          </CardHeader>
          <CardBody>
            {admin.workspaceIds.length === 0 ? (
              <p className="m-0 text-sm text-slate-500">No workspace IDs returned for this account.</p>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {admin.workspaceIds.map((id) => (
                  <li key={id} className="font-mono text-xs text-slate-700">
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </DataPageLayout>
  );
}
