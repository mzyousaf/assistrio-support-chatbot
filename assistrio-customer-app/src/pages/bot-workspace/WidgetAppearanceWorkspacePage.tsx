import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { WidgetAppearanceSection } from './WidgetAppearanceSection';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';

/** Global: omit preview lane + mobile sheet when false. */
export const APPEARANCE_IN_APP_PREVIEW = true;

export function WidgetAppearanceWorkspacePage() {
  return (
    <WidgetPreviewContainer
      previewMountId="appearance-widget-preview-root"
      previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
      previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
      preview={
        APPEARANCE_IN_APP_PREVIEW
          ? ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
          : undefined
      }
    >
      <WidgetAppearanceSection />
    </WidgetPreviewContainer>
  );
}
