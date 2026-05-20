import { useState } from 'react';
import { toast } from 'sonner';
import { testAdminOpenAiPlatformKey } from '@/api/adminSettingsApi';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataPageLayout } from '@/layout/workspace-layout';
import { SettingsStatusBadge } from './settingsUi';

type OpenAiTestState = 'idle' | 'loading' | 'success' | 'error';

export function AdminDeveloperSettingsPage() {
  const [openAiState, setOpenAiState] = useState<OpenAiTestState>('idle');
  const [openAiMessage, setOpenAiMessage] = useState<string | null>(null);

  async function handleTestOpenAi() {
    setOpenAiState('loading');
    setOpenAiMessage(null);
    const res = await testAdminOpenAiPlatformKey();
    if (res.ok) {
      setOpenAiState('success');
      setOpenAiMessage(res.data.message || 'Platform OpenAI API key is valid.');
      toast.success('OpenAI key test passed');
      return;
    }
    setOpenAiState('error');
    setOpenAiMessage(res.error || 'Platform OpenAI API key test failed.');
    toast.error(res.error || 'OpenAI key test failed');
  }

  return (
    <DataPageLayout
      title="Developer"
      description="Internal checks and operational tools. Keys are never displayed."
      embedded
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>OpenAI key test</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="m-0 text-sm text-slate-600">
              Validates the server-configured <code className="text-xs">OPENAI_API_KEY</code> via{' '}
              <code className="text-xs">POST /api/admin/openai/test-platform-key</code>. The key is not sent to the
              browser or returned in the response.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" onClick={() => void handleTestOpenAi()} disabled={openAiState === 'loading'}>
                {openAiState === 'loading' ? 'Testing…' : 'Test OpenAI key'}
              </Button>
              {openAiState === 'success' ? <SettingsStatusBadge tone="success">Valid</SettingsStatusBadge> : null}
              {openAiState === 'error' ? <SettingsStatusBadge tone="danger">Failed</SettingsStatusBadge> : null}
              {openAiState === 'idle' ? <SettingsStatusBadge tone="neutral">Not tested</SettingsStatusBadge> : null}
            </div>
            {openAiMessage ? (
              <p
                className={
                  openAiState === 'error'
                    ? 'm-0 text-sm text-red-700'
                    : 'm-0 text-sm text-emerald-800'
                }
                role="status"
              >
                {openAiMessage}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className="opacity-70">
          <CardHeader>
            <CardTitle>Seed tools</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="m-0 text-sm text-slate-500">Coming soon — database seeding is not exposed in the admin UI yet.</p>
          </CardBody>
        </Card>

        <Card className="opacity-70">
          <CardHeader>
            <CardTitle>Job runner</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="m-0 text-sm text-slate-500">Coming soon — background job controls are not available here yet.</p>
          </CardBody>
        </Card>

        <Card className="opacity-70">
          <CardHeader>
            <CardTitle>Internal operations</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="m-0 text-sm text-slate-500">Coming soon — operational tools will be added when safely exposed.</p>
          </CardBody>
        </Card>
      </div>
    </DataPageLayout>
  );
}
