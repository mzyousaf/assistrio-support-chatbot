import { createPortal } from 'react-dom';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CustomerAuthProvider } from './auth/CustomerAuthContext';
import { AppShell } from './layout/AppShell';
import { WorkspaceDiscardModalProvider } from './pages/bot-workspace/WorkspaceDiscardModal';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { PublicLoginRoute } from './layout/PublicLoginRoute';
import { BotWorkspaceLayout } from './pages/bot-workspace/BotWorkspaceLayout';
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

              {/* ── Playground ── */}
              <Route path="playground/profile" element={<ProfileWorkspacePage />} />
              <Route path="playground/behavior" element={<BehaviorWorkspacePage />} />
              <Route path="playground/capture-leads" element={<CaptureLeadsWorkspacePage />} />
              <Route path="playground/ai" element={<AiIntegrationsWorkspacePage />} />
              <Route path="playground/chat" element={<ChatExperienceWorkspacePage />} />
              <Route path="playground/appearance" element={<WidgetAppearanceWorkspacePage />} />
              <Route path="playground/deploy" element={<PublishWorkspacePage />} />
              <Route path="playground/publish" element={<Navigate to="../deploy" replace />} />

              {/* ── Knowledge Base ── */}
              <Route path="knowledge/notes" element={<KnowledgeBaseWorkspacePage />} />
              <Route path="knowledge/faqs" element={<KnowledgeBaseWorkspacePage />} />
              <Route path="knowledge/documents" element={<KnowledgeBaseWorkspacePage />} />

              {/* ── Insights ── */}
              <Route path="activity/chat-logs" element={<WorkspaceComingSoonSection title="Conversations" description="A full conversation log with search and filters will appear here." />} />
              <Route path="activity/leads" element={<WorkspaceComingSoonSection title="Leads" description="A dedicated lead inbox and exports will live here. For now, see lead counts in Analytics → Chats." />} />
              <Route path="analytics/chats" element={<InsightsSection />} />
              <Route path="analytics/topics" element={<WorkspaceComingSoonSection title="Topics" description="Topic clustering and trends will appear here once analytics are expanded." />} />
              <Route path="analytics/sentiment" element={<WorkspaceComingSoonSection title="Sentiment" description="Sentiment breakdowns over time will appear here in a future release." />} />
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
