import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';
import { ProfileSection } from './ProfileSection';

/** Global: omit preview lane + mobile sheet when false. */
export const PROFILE_IN_APP_PREVIEW = true;

export function ProfileWorkspacePage() {
  return (
    <WidgetPreviewContainer
      previewMountId="profile-widget-preview-root"
      previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
      previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
      preview={
        PROFILE_IN_APP_PREVIEW
          ? ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
          : undefined
      }
    >
      <ProfileSection />
    </WidgetPreviewContainer>
  );
}
