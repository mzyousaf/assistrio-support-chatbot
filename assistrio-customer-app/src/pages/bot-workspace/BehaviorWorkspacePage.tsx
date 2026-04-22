import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';
import { BehaviorSection } from './BehaviorSection';
import { BehaviorWorkspaceProvider } from './BehaviorWorkspaceContext';

/** Global: omit preview lane + mobile sheet when false. */
export const BEHAVIOR_IN_APP_PREVIEW = true;

export function BehaviorWorkspacePage() {
  return (
    <BehaviorWorkspaceProvider>
      <WidgetPreviewContainer
        previewMountId="behavior-widget-preview-root"
        previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
        previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
        preview={
          BEHAVIOR_IN_APP_PREVIEW
            ? ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
            : undefined
        }
      >
        <BehaviorSection />
      </WidgetPreviewContainer>
    </BehaviorWorkspaceProvider>
  );
}
