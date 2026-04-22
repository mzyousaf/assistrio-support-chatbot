import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';
import { CaptureLeadsSection } from './CaptureLeadsSection';
import { CaptureLeadsWorkspaceProvider } from './CaptureLeadsWorkspaceContext';

export const CAPTURE_LEADS_IN_APP_PREVIEW = true;

export function CaptureLeadsWorkspacePage() {
  return (
    <CaptureLeadsWorkspaceProvider>
      <WidgetPreviewContainer
        previewMountId="capture-leads-widget-preview-root"
        previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
        previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
        preview={
          CAPTURE_LEADS_IN_APP_PREVIEW
            ? ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
            : undefined
        }
      >
        <CaptureLeadsSection />
      </WidgetPreviewContainer>
    </CaptureLeadsWorkspaceProvider>
  );
}
