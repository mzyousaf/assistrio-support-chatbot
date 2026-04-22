import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';
import { KnowledgeBaseSection } from './KnowledgeSection';

/** Global: omit preview lane + mobile sheet when false. */
export const KNOWLEDGE_BASE_IN_APP_PREVIEW = true;

export function KnowledgeBaseWorkspacePage() {
  return (
    <WidgetPreviewContainer
      previewMountId="knowledge-base-widget-preview-root"
      previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
      previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
      preview={
        KNOWLEDGE_BASE_IN_APP_PREVIEW
          ? ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
          : undefined
      }
    >
      <KnowledgeBaseSection />
    </WidgetPreviewContainer>
  );
}
