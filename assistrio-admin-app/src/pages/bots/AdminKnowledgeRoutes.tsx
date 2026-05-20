import { Navigate, Route, Routes } from 'react-router-dom';
import { KnowledgeBaseLayout } from '@/pages/bot-workspace/knowledge/KnowledgeBaseLayout';
import { KnowledgeOverviewPage } from '@/pages/bot-workspace/knowledge/KnowledgeOverviewPage';
import { KnowledgeDocumentsPage } from '@/pages/bot-workspace/KnowledgeSection';
import { DocumentItemRouteLayout } from '@/pages/bot-workspace/knowledge/knowledgeItemRouteLayouts';
import { DocumentDetailPage } from '@/pages/bot-workspace/knowledge/DocumentDetailPage';
import { DocumentEditPage } from '@/pages/bot-workspace/knowledge/DocumentEditPage';
import { QaListPage } from '@/pages/bot-workspace/knowledge/QaListPage';
import { QaItemRouteLayout } from '@/pages/bot-workspace/knowledge/knowledgeItemRouteLayouts';
import { QaDetailPage } from '@/pages/bot-workspace/knowledge/QaDetailPage';
import { QaEditPage } from '@/pages/bot-workspace/knowledge/QaEditPage';
import { SnippetsListPage } from '@/pages/bot-workspace/knowledge/SnippetsListPage';
import { SnippetItemRouteLayout } from '@/pages/bot-workspace/knowledge/knowledgeItemRouteLayouts';
import { SnippetDetailPage } from '@/pages/bot-workspace/knowledge/SnippetDetailPage';
import { SnippetEditPage } from '@/pages/bot-workspace/knowledge/SnippetEditPage';
import { AdminDatasheetsPlaceholderPage } from './AdminDatasheetsPlaceholderPage';
import { AdminKnowledgeShell } from './AdminKnowledgeShell';

export function AdminKnowledgeRoutes() {
  return (
    <Routes>
      <Route element={<AdminKnowledgeShell />}>
        <Route element={<KnowledgeBaseLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<KnowledgeOverviewPage />} />
          <Route path="documents/:docId" element={<DocumentItemRouteLayout />}>
            <Route index element={<DocumentDetailPage />} />
            <Route path="edit" element={<DocumentEditPage />} />
          </Route>
          <Route path="documents" element={<KnowledgeDocumentsPage />} />
          <Route path="faqs" element={<QaListPage />} />
          <Route path="faqs/:index" element={<QaItemRouteLayout />}>
            <Route index element={<QaDetailPage />} />
            <Route path="edit" element={<QaEditPage />} />
          </Route>
          <Route path="notes" element={<SnippetsListPage />} />
          <Route path="notes/:index" element={<SnippetItemRouteLayout />}>
            <Route index element={<SnippetDetailPage />} />
            <Route path="edit" element={<SnippetEditPage />} />
          </Route>
          <Route path="snippets" element={<Navigate to="../notes" replace />} />
          <Route path="snippets/*" element={<Navigate to="../notes" replace />} />
          <Route path="datasheets" element={<AdminDatasheetsPlaceholderPage />} />
          <Route path="datasheets/*" element={<AdminDatasheetsPlaceholderPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
