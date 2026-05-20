import { createPortal } from 'react-dom';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AdminAuthProvider } from './auth/AdminAuthContext';
import { AppShell } from './layout/AppShell';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { PublicLoginRoute } from './layout/PublicLoginRoute';
import { AppToaster } from './components/AppToaster';
import { LoginPage } from './pages/LoginPage';
import { BotsListPage } from './pages/BotsListPage';
import { AdminBotWorkspaceProvider } from './auth/AdminBotWorkspaceContext';
import { BotDetailLayout } from './pages/bots/BotDetailLayout';
import { BotOverviewPage } from './pages/bots/BotOverviewPage';
import { AdminBotAnalyticsPage } from './pages/bots/AdminBotAnalyticsPage';
import { AdminDeployPage } from './pages/bots/AdminDeployPage';
import { AdminProfilePage } from './pages/bots/AdminProfilePage';
import { AdminBehaviorPage } from './pages/bots/AdminBehaviorPage';
import { AdminKnowledgeRoutes } from './pages/bots/AdminKnowledgeRoutes';
import { AdminConversationsInsightsPage } from './pages/bot-workspace/AdminConversationsInsightsPage';
import { AdminSettingsLayout } from './pages/settings/AdminSettingsLayout';
import { AdminAccountSettingsPage } from './pages/settings/AdminAccountSettingsPage';
import { AdminSystemSettingsPage } from './pages/settings/AdminSystemSettingsPage';
import { AdminDeveloperSettingsPage } from './pages/settings/AdminDeveloperSettingsPage';
import { AdminInsightsLayout } from './pages/insights/AdminInsightsLayout';
import { AdminPlatformAnalyticsPage } from './pages/insights/AdminPlatformAnalyticsPage';
import { AdminMarketingVisitorsPage } from './pages/insights/AdminMarketingVisitorsPage';
import { AdminMarketingVisitorDetailPage } from './pages/insights/AdminMarketingVisitorDetailPage';
import { CustomersListPage } from './pages/customers/CustomersListPage';
import { CustomerDetailLayout } from './pages/customers/CustomerDetailLayout';
import { CustomerOverviewPage } from './pages/customers/CustomerOverviewPage';
import { CustomerWorkspacesPage } from './pages/customers/CustomerWorkspacesPage';
import { CustomerBotsPage } from './pages/customers/CustomerBotsPage';
import { CustomerAnalyticsPage } from './pages/customers/CustomerAnalyticsPage';
import { AdminBotsAreaLayout } from './pages/admin-bots/AdminBotsAreaLayout';
import { AdminBotsListPage } from './pages/admin-bots/AdminBotsListPage';
import { AdminBotNewPage } from './pages/admin-bots/AdminBotNewPage';
import { AdminBotDetailPage } from './pages/admin-bots/AdminBotDetailPage';

export function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <>
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
              <Route path="/" element={<Navigate to="/customers" replace />} />
              <Route path="/customers" element={<CustomersListPage />} />
              <Route path="/customers/:customerId" element={<CustomerDetailLayout />}>
                <Route index element={<CustomerOverviewPage />} />
                <Route path="workspaces" element={<CustomerWorkspacesPage />} />
                <Route path="bots" element={<CustomerBotsPage />} />
                <Route path="analytics" element={<CustomerAnalyticsPage />} />
              </Route>
              <Route path="/bots" element={<BotsListPage />} />
              <Route
                path="/bots/:id"
                element={
                  <AdminBotWorkspaceProvider>
                    <BotDetailLayout />
                  </AdminBotWorkspaceProvider>
                }
              >
                <Route index element={<BotOverviewPage />} />
                <Route path="profile" element={<AdminProfilePage />} />
                <Route path="behavior" element={<AdminBehaviorPage />} />
                <Route path="knowledge/*" element={<AdminKnowledgeRoutes />} />
                <Route path="deploy" element={<AdminDeployPage />} />
                <Route path="conversations" element={<AdminConversationsInsightsPage />} />
                <Route path="insights" element={<Navigate to="conversations" replace />} />
                <Route path="insights/*" element={<BotInsightsRedirect />} />
                <Route path="analytics" element={<AdminBotAnalyticsPage />} />
              </Route>
              <Route path="/admin-bots" element={<AdminBotsAreaLayout />}>
                <Route index element={<AdminBotsListPage />} />
                <Route path="new" element={<AdminBotNewPage />} />
                <Route path=":botId" element={<AdminBotDetailPage />} />
              </Route>
              <Route path="/insights" element={<AdminInsightsLayout />}>
                <Route index element={<Navigate to="platform-analytics" replace />} />
                <Route path="platform-analytics" element={<AdminPlatformAnalyticsPage />} />
                <Route path="marketing-visitors" element={<AdminMarketingVisitorsPage />} />
                <Route path="marketing-visitors/:visitorId" element={<AdminMarketingVisitorDetailPage />} />
              </Route>
              <Route path="/settings" element={<AdminSettingsLayout />}>
                <Route index element={<Navigate to="account" replace />} />
                <Route path="account" element={<AdminAccountSettingsPage />} />
                <Route path="system" element={<AdminSystemSettingsPage />} />
                <Route path="developer" element={<AdminDeveloperSettingsPage />} />
              </Route>
              {/* Legacy redirects */}
              <Route path="/analytics" element={<Navigate to="/insights/platform-analytics" replace />} />
              <Route path="/analytics/platform-bots" element={<Navigate to="/admin-bots" replace />} />
              <Route path="/analytics/leads" element={<Navigate to="/insights/platform-analytics" replace />} />
              <Route path="/analytics/visitors" element={<Navigate to="/insights/marketing-visitors" replace />} />
              <Route path="/analytics/visitors/:visitorId" element={<LegacyVisitorRedirect />} />
              <Route path="/analytics/bots" element={<Navigate to="/admin-bots" replace />} />
              <Route path="/analytics/bots/:botId" element={<AnalyticsBotRedirect />} />
              <Route path="/visitors" element={<Navigate to="/insights/marketing-visitors" replace />} />
              <Route path="/visitors/:visitorId" element={<LegacyVisitorRedirect />} />
            </Route>
            <Route path="*" element={<Navigate to="/customers" replace />} />
          </Routes>
          {createPortal(<AppToaster />, document.body)}
        </>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}

function AnalyticsBotRedirect() {
  const { botId = '' } = useParams<{ botId: string }>();
  return <Navigate to={`/bots/${botId}/analytics`} replace />;
}

function LegacyVisitorRedirect() {
  const { visitorId = '' } = useParams<{ visitorId: string }>();
  return <Navigate to={`/insights/marketing-visitors/${encodeURIComponent(visitorId)}`} replace />;
}

function BotInsightsRedirect() {
  const { id = '' } = useParams<{ id: string }>();
  const rest = window.location.pathname.replace(/^\/bots\/[^/]+\/insights\/?/, '');
  const suffix = rest && rest !== 'conversations' ? `/${rest}` : '';
  return <Navigate to={`/bots/${id}/conversations${suffix}`} replace />;
}
