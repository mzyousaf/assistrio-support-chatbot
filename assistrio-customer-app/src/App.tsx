import { createPortal } from 'react-dom';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { CustomerAuthProvider } from './auth/CustomerAuthContext';
import { AppShell } from './layout/AppShell';
import { WorkspaceDiscardModalProvider } from './pages/bot-workspace/WorkspaceDiscardModal';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { OnboardingCompleteRoute } from './layout/OnboardingCompleteRoute';
import { PublicLoginRoute } from './layout/PublicLoginRoute';
import { BotWorkspaceLayout } from './pages/bot-workspace/BotWorkspaceLayout';
import { PlaygroundLayout } from './pages/bot-workspace/PlaygroundLayout';
import { PublishWorkspacePage } from './pages/bot-workspace/PublishWorkspacePage';
import { ChatsAnalyticsPage } from './pages/bot-workspace/analytics/chats/ChatsAnalyticsPage';
import { LeadsAnalyticsPage } from './pages/bot-workspace/analytics/leads/LeadsAnalyticsPage';
import { KnowledgeBaseLayout } from './pages/bot-workspace/knowledge/KnowledgeBaseLayout';
import { KnowledgeOverviewPage } from './pages/bot-workspace/knowledge/KnowledgeOverviewPage';
import { SnippetsListPage } from './pages/bot-workspace/knowledge/SnippetsListPage';
import { SnippetEditPage } from './pages/bot-workspace/knowledge/SnippetEditPage';
import { QaListPage } from './pages/bot-workspace/knowledge/QaListPage';
import { QaEditPage } from './pages/bot-workspace/knowledge/QaEditPage';
import { DatasheetsListPage } from './pages/bot-workspace/knowledge/DatasheetsListPage';
import { DatasheetEditPage } from './pages/bot-workspace/knowledge/DatasheetEditPage';
import { SnippetDetailPage } from './pages/bot-workspace/knowledge/SnippetDetailPage';
import { QaDetailPage } from './pages/bot-workspace/knowledge/QaDetailPage';
import { KnowledgeDatasheetDetailPage } from './pages/bot-workspace/knowledge/KnowledgeDatasheetDetailPage';
import { DocumentDetailPage } from './pages/bot-workspace/knowledge/DocumentDetailPage';
import { DocumentEditPage } from './pages/bot-workspace/knowledge/DocumentEditPage';
import { KnowledgeSuggestionsPage } from './pages/bot-workspace/knowledge/KnowledgeSuggestionsPage';
import { KnowledgeSuggestionDetailPage } from './pages/bot-workspace/knowledge/KnowledgeSuggestionDetailPage';
import { KnowledgeSuggestionEditPage } from './pages/bot-workspace/knowledge/KnowledgeSuggestionEditPage';
import { KnowledgeDocumentsPage } from './pages/bot-workspace/KnowledgeSection';
import {
  DatasheetItemRouteLayout,
  DocumentItemRouteLayout,
  KnowledgeSuggestionItemRouteLayout,
  QaItemRouteLayout,
  SnippetItemRouteLayout,
} from './pages/bot-workspace/knowledge/knowledgeItemRouteLayouts';
import { WidgetAppearanceWorkspacePage } from './pages/bot-workspace/WidgetAppearanceWorkspacePage';
import { BehaviorWorkspacePage } from './pages/bot-workspace/BehaviorWorkspacePage';
import { CaptureLeadsWorkspacePage } from './pages/bot-workspace/CaptureLeadsWorkspacePage';
import { ChatExperienceWorkspacePage } from './pages/bot-workspace/ChatExperienceWorkspacePage';
import { ProfileWorkspacePage } from './pages/bot-workspace/ProfileWorkspacePage';
import { AiIntegrationsWorkspacePage } from './pages/bot-workspace/AiIntegrationsWorkspacePage';
import { TranslationWorkspacePage } from './pages/bot-workspace/TranslationWorkspacePage';
import { TopicsAnalyticsPage } from './pages/bot-workspace/analytics/topics/TopicsAnalyticsPage';
import { SentimentAnalyticsPage } from './pages/bot-workspace/analytics/sentiment/SentimentAnalyticsPage';
import { AgentResourcesAnalyticsPage } from './pages/bot-workspace/analytics/agent-resources/AgentResourcesAnalyticsPage';
import { ConversationsInsightsPage } from './pages/bot-workspace/ConversationsInsightsPage';
import { CustomerLeadsPage } from './pages/bot-workspace/CustomerLeadsPage';
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
import { OnboardingYouAreLiveStep } from './pages/onboarding/OnboardingYouAreLiveStep';
import { OnboardingKnowledgeStep } from './pages/onboarding/OnboardingKnowledgeStep';
import { OnboardingGate } from './pages/onboarding/OnboardingGate';
import { OnboardingLayout } from './pages/onboarding/OnboardingLayout';
import { OnboardingResumeRedirect } from './pages/onboarding/OnboardingResumeRedirect';
import { PreserveSearchNavigate } from './routes/PreserveSearchNavigate';
import { PostLoginRedirect } from './routes/PostLoginRedirect';
import { CUSTOMER_ROUTES } from './routes/customerRoutes';
import { AppToaster } from './components/AppToaster';
import { SharedChatPage } from './pages/public/SharedChatPage';
import { IframeChatPage } from './pages/public/IframeChatPage';

function RedirectToPlaygroundKnowledge({
  tab,
}: {
  tab: 'snippets' | 'faqs' | 'documents' | 'datasheets' | 'notes' | 'suggestions';
}) {
  const { id } = useParams();
  if (!id) return null;
  const path = tab === 'notes' ? 'snippets' : tab;
  return <Navigate to={`/bots/${id}/playground/knowledgebase/${path}`} replace />;
}

function RedirectToPlaygroundKnowledgeSub({ segment }: { segment: string }) {
  const { id } = useParams();
  if (!id) return null;
  return <Navigate to={`/bots/${id}/playground/knowledgebase/${segment}`} replace />;
}


export function App() {
  return (
    <CustomerAuthProvider>
      <BrowserRouter>
        <>
        <WorkspaceDiscardModalProvider>
        <Routes>
          <Route
            path={CUSTOMER_ROUTES.login}
            element={
              <PublicLoginRoute>
                <LoginPage />
              </PublicLoginRoute>
            }
          />
          <Route path="/share/:slug" element={<SharedChatPage />} />
          <Route path="/iframe/:botId" element={<IframeChatPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path={CUSTOMER_ROUTES.home} element={<PostLoginRedirect />} />
            <Route path={CUSTOMER_ROUTES.dashboard} element={<PostLoginRedirect />} />
            <Route path="/onboarding" element={<OnboardingGate />}>
              <Route element={<OnboardingLayout />}>
                <Route index element={<OnboardingResumeRedirect />} />
                <Route path="agent-profile" element={<OnboardingAgentProfileStep />} />
                <Route path="describe-profile" element={<OnboardingDescribeStep />} />
                <Route path="knowledge-base" element={<OnboardingKnowledgeStep />} />
                <Route path="go-live" element={<OnboardingGoLiveStep />} />
                <Route path="you-are-live" element={<OnboardingYouAreLiveStep />} />
              </Route>
            </Route>
            <Route element={<OnboardingCompleteRoute />}>
            <Route element={<AppShell />}>
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
              <Route index element={<PreserveSearchNavigate to="playground/profile" />} />

              {/* Playground: one layout + stable widget preview; nested section routes only swap <Outlet />. */}
              <Route path="playground" element={<PlaygroundLayout />}>
                <Route index element={<PreserveSearchNavigate to="profile" />} />
                <Route path="profile" element={<ProfileWorkspacePage />} />
                <Route path="behavior" element={<BehaviorWorkspacePage />} />
                <Route path="capture-leads" element={<CaptureLeadsWorkspacePage />} />
                <Route path="ai" element={<AiIntegrationsWorkspacePage />} />
                <Route path="translation" element={<TranslationWorkspacePage />} />
                <Route path="chat" element={<ChatExperienceWorkspacePage />} />
                <Route path="appearance" element={<WidgetAppearanceWorkspacePage />} />
                <Route path="deploy" element={<PublishWorkspacePage />} />
                <Route path="publish" element={<Navigate to="../deploy" replace />} />
                <Route path="knowledgebase" element={<KnowledgeBaseLayout />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<KnowledgeOverviewPage />} />
                  <Route path="documents/:docId" element={<DocumentItemRouteLayout />}>
                    <Route index element={<DocumentDetailPage />} />
                    <Route path="edit" element={<DocumentEditPage />} />
                  </Route>
                  <Route path="documents" element={<KnowledgeDocumentsPage />} />
                  <Route path="suggestions/:index" element={<KnowledgeSuggestionItemRouteLayout />}>
                    <Route index element={<KnowledgeSuggestionDetailPage />} />
                    <Route path="edit" element={<KnowledgeSuggestionEditPage />} />
                  </Route>
                  <Route path="suggestions" element={<KnowledgeSuggestionsPage />} />
                  <Route path="snippets" element={<SnippetsListPage />} />
                  <Route path="snippets/:index" element={<SnippetItemRouteLayout />}>
                    <Route index element={<SnippetDetailPage />} />
                    <Route path="edit" element={<SnippetEditPage />} />
                  </Route>
                  <Route path="faqs" element={<QaListPage />} />
                  <Route path="faqs/:index" element={<QaItemRouteLayout />}>
                    <Route index element={<QaDetailPage />} />
                    <Route path="edit" element={<QaEditPage />} />
                  </Route>
                  <Route path="datasheets" element={<DatasheetsListPage />} />
                  <Route path="datasheets/:index" element={<DatasheetItemRouteLayout />}>
                    <Route index element={<KnowledgeDatasheetDetailPage />} />
                    <Route path="fullscreen" element={<DatasheetEditPage />} />
                    <Route path="edit" element={<DatasheetEditPage />} />
                  </Route>
                  <Route path="notes" element={<Navigate to="../snippets" replace />} />
                  <Route path="tables" element={<Navigate to="../datasheets" replace />} />
                </Route>
              </Route>
              <Route path="knowledge/notes" element={<RedirectToPlaygroundKnowledge tab="notes" />} />
              <Route path="knowledge/faqs" element={<RedirectToPlaygroundKnowledge tab="faqs" />} />
              <Route path="knowledge/documents" element={<RedirectToPlaygroundKnowledge tab="documents" />} />
              <Route path="knowledge/datasheets" element={<RedirectToPlaygroundKnowledge tab="datasheets" />} />
              <Route path="knowledge/tables" element={<RedirectToPlaygroundKnowledge tab="datasheets" />} />
              <Route path="knowledge/suggestions" element={<RedirectToPlaygroundKnowledge tab="suggestions" />} />
              <Route path="knowledge/overview" element={<RedirectToPlaygroundKnowledgeSub segment="overview" />} />

              {/* ── Insights (distinct from admin: `/admin/bots/:id/insights/...` on the operator app) ── */}
              <Route
                path="activity/chat-logs"
                element={<Navigate to="insights/conversations" replace />}
              />
              <Route path="insights/conversations" element={<ConversationsInsightsPage />} />
              <Route
                path="activity/leads"
                element={<CustomerLeadsPage />}
              />
              <Route path="analytics/chats" element={<ChatsAnalyticsPage />} />
              <Route path="analytics/agent-resources" element={<AgentResourcesAnalyticsPage />} />
              <Route
                path="analytics/knowledge-sources"
                element={<Navigate to="analytics/agent-resources" replace />}
              />
              <Route path="analytics/leads" element={<LeadsAnalyticsPage />} />
              <Route path="usage" element={<Navigate to="analytics/agent-resources" replace />} />
              <Route path="analytics/topics" element={<TopicsAnalyticsPage />} />
              <Route path="analytics/sentiment" element={<SentimentAnalyticsPage />} />
            </Route>
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
