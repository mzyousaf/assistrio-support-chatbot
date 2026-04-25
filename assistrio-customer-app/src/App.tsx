import { createPortal } from 'react-dom';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { CustomerAuthProvider } from './auth/CustomerAuthContext';
import { AppShell } from './layout/AppShell';
import { WorkspaceDiscardModalProvider } from './pages/bot-workspace/WorkspaceDiscardModal';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { PublicLoginRoute } from './layout/PublicLoginRoute';
import { BotWorkspaceLayout } from './pages/bot-workspace/BotWorkspaceLayout';
import { PlaygroundLayout } from './pages/bot-workspace/PlaygroundLayout';
import { PublishWorkspacePage } from './pages/bot-workspace/PublishWorkspacePage';
import { InsightsSection } from './pages/bot-workspace/InsightsSection';
import { KnowledgeBaseWorkspacePage } from './pages/bot-workspace/KnowledgeBaseWorkspacePage';
import { WidgetAppearanceWorkspacePage } from './pages/bot-workspace/WidgetAppearanceWorkspacePage';
import { BehaviorWorkspacePage } from './pages/bot-workspace/BehaviorWorkspacePage';
import { CaptureLeadsWorkspacePage } from './pages/bot-workspace/CaptureLeadsWorkspacePage';
import { ChatExperienceWorkspacePage } from './pages/bot-workspace/ChatExperienceWorkspacePage';
import { ProfileWorkspacePage } from './pages/bot-workspace/ProfileWorkspacePage';
import { AiIntegrationsWorkspacePage } from './pages/bot-workspace/AiIntegrationsWorkspacePage';
import { WorkspaceComingSoonSection } from './pages/bot-workspace/WorkspaceComingSoonSection';
import { ConversationsInsightsPage } from './pages/bot-workspace/ConversationsInsightsPage';
import { BotsListPage } from './pages/BotsListPage';
import { LoginPage } from './pages/LoginPage';
import { PlansPage } from './pages/PlansPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsPlaceholderPage } from './pages/settings/SettingsPlaceholderPage';
import { UsagePage } from './pages/UsagePage';
import { OnboardingAgentProfileStep } from './pages/onboarding/OnboardingAgentProfileStep';
import { OnboardingDescribeStep } from './pages/onboarding/OnboardingDescribeStep';
import { OnboardingGoLiveStep } from './pages/onboarding/OnboardingGoLiveStep';
import { OnboardingKnowledgeStep } from './pages/onboarding/OnboardingKnowledgeStep';
import { OnboardingGate } from './pages/onboarding/OnboardingGate';
import { OnboardingLayout } from './pages/onboarding/OnboardingLayout';
import { PostLoginRedirect } from './routes/PostLoginRedirect';
import { AppToaster } from './components/AppToaster';

function RedirectToPlaygroundKnowledge({ tab }: { tab: 'notes' | 'faqs' | 'documents' }) {
  const { id } = useParams();
  if (!id) return null;
  return <Navigate to={`/bots/${id}/playground/knowledgebase/${tab}`} replace />;
}

function RedirectPlaygroundKnowledgeBaseIndex() {
  return <Navigate to="notes" replace />;
}

export function App() {
  return (
    <CustomerAuthProvider>
      <BrowserRouter>
        <>
        <WorkspaceDiscardModalProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicLoginRoute>
                <LoginPage />
              </PublicLoginRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<PostLoginRedirect />} />
            <Route path="/dashboard" element={<Navigate to="/bots" replace />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/plans" element={<Navigate to="/settings/plans" replace />} />
            <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
            <Route path="/settings/general" element={<SettingsPage />} />
            <Route
              path="/settings/members"
              element={
                <SettingsPlaceholderPage
                  title="Members"
                  description="Invite teammates and manage roles for this workspace."
                />
              }
            />
            <Route
              path="/settings/billing"
              element={
                <SettingsPlaceholderPage
                  title="Billing"
                  description="Plans, invoices, and payment methods will appear here."
                />
              }
            />
            <Route path="/settings/plans" element={<PlansPage />} />
            <Route
              path="/settings/api-keys"
              element={
                <SettingsPlaceholderPage
                  title="API keys"
                  description="Create and rotate API keys for programmatic access to your workspace."
                />
              }
            />
            <Route path="/bots" element={<BotsListPage />} />
            <Route path="/bots/:id" element={<BotWorkspaceLayout />}>
              <Route index element={<Navigate to="playground/profile" replace />} />

              {/* Playground: one layout + stable widget preview; nested section routes only swap <Outlet />. */}
              <Route path="playground" element={<PlaygroundLayout />}>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<ProfileWorkspacePage />} />
                <Route path="behavior" element={<BehaviorWorkspacePage />} />
                <Route path="capture-leads" element={<CaptureLeadsWorkspacePage />} />
                <Route path="ai" element={<AiIntegrationsWorkspacePage />} />
                <Route path="chat" element={<ChatExperienceWorkspacePage />} />
                <Route path="appearance" element={<WidgetAppearanceWorkspacePage />} />
                <Route path="deploy" element={<PublishWorkspacePage />} />
                <Route path="publish" element={<Navigate to="../deploy" replace />} />
                <Route path="knowledgebase" element={<RedirectPlaygroundKnowledgeBaseIndex />} />
                <Route path="knowledgebase/notes" element={<KnowledgeBaseWorkspacePage />} />
                <Route path="knowledgebase/faqs" element={<KnowledgeBaseWorkspacePage />} />
                <Route path="knowledgebase/documents" element={<KnowledgeBaseWorkspacePage />} />
              </Route>
              <Route path="knowledge/notes" element={<RedirectToPlaygroundKnowledge tab="notes" />} />
              <Route path="knowledge/faqs" element={<RedirectToPlaygroundKnowledge tab="faqs" />} />
              <Route path="knowledge/documents" element={<RedirectToPlaygroundKnowledge tab="documents" />} />

              {/* ── Insights (distinct from admin: `/admin/bots/:id/insights/...` on the operator app) ── */}
              <Route
                path="activity/chat-logs"
                element={<Navigate to="insights/conversations" replace />}
              />
              <Route path="insights/conversations" element={<ConversationsInsightsPage />} />
              <Route
                path="activity/leads"
                element={
                  <WorkspaceComingSoonSection
                    title="Leads"
                    description="A dedicated lead inbox and exports will live here. For now, see lead counts in Analytics → Chats."
                    insightBleed
                  />
                }
              />
              <Route path="analytics/chats" element={<InsightsSection />} />
              <Route
                path="analytics/topics"
                element={
                  <WorkspaceComingSoonSection
                    title="Topics"
                    description="Topic clustering and trends will appear here once analytics are expanded."
                    insightBleed
                  />
                }
              />
              <Route
                path="analytics/sentiment"
                element={
                  <WorkspaceComingSoonSection
                    title="Sentiment"
                    description="Sentiment breakdowns over time will appear here in a future release."
                    insightBleed
                  />
                }
              />
            </Route>
            <Route path="/onboarding" element={<OnboardingGate />}>
              <Route element={<OnboardingLayout />}>
                <Route index element={<Navigate to="agent-profile" replace />} />
                <Route path="agent-profile" element={<OnboardingAgentProfileStep />} />
                <Route path="describe-profile" element={<OnboardingDescribeStep />} />
                <Route path="knowledge-base" element={<OnboardingKnowledgeStep />} />
                <Route path="go-live" element={<OnboardingGoLiveStep />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </WorkspaceDiscardModalProvider>
        {/* Portaled to body so toasts paint above Modal overlays (z-[300]) on document.body */}
        {createPortal(<AppToaster />, document.body)}
        </>
      </BrowserRouter>
    </CustomerAuthProvider>
  );
}
