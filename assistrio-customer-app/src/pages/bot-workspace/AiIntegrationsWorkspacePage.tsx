import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { AiIntegrationsSection } from './AiIntegrationsSection';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';

/** Global: omit preview lane + mobile sheet when false. */
export const AI_INTEGRATIONS_IN_APP_PREVIEW = true;

export function AiIntegrationsWorkspacePage() {
  return (
    <WidgetPreviewContainer
      previewMountId="ai-integrations-widget-preview-root"
      previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
      previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
      preview={
        AI_INTEGRATIONS_IN_APP_PREVIEW
          ? ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
          : undefined
      }
    >
      <AiIntegrationsSection />
    </WidgetPreviewContainer>
  );
}
