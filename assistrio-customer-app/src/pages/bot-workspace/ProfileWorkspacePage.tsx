import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ProfilePreview } from './ProfilePreview';
import { ProfileSection } from './ProfileSection';

/** Global: omit preview lane + mobile sheet when false. */
export const PROFILE_IN_APP_PREVIEW = true;

export function ProfileWorkspacePage() {
  return (
    <WidgetPreviewContainer
      previewMountId="profile-widget-preview-root"
      preview={
        PROFILE_IN_APP_PREVIEW
          ? ({ mountId }) => <ProfilePreview mountId={mountId} />
          : undefined
      }
    >
      <ProfileSection />
    </WidgetPreviewContainer>
  );
}
