import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ChatExperienceSection } from './ChatExperienceSection';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';

/** Global: omit preview lane + mobile sheet when false. */
export const CHAT_IN_APP_PREVIEW = true;

export function ChatExperienceWorkspacePage() {
  return (
    <WidgetPreviewContainer
      previewMountId="chat-widget-preview-root"
      previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
      previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
      preview={
        CHAT_IN_APP_PREVIEW
          ? ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
          : undefined
      }
    >
      <ChatExperienceSection />
    </WidgetPreviewContainer>
  );
}
