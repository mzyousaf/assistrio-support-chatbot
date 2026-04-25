import { Outlet, useLocation } from 'react-router-dom';
import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';

/**
 * One workspace shell for all playground sub-routes: editor (`<Outlet />`) + a **single** inline
 * widget preview with a **stable** portal `mountId` so the live embed does not remount on section changes.
 * Deploy & Go Live uses the same grid without the right-lane slot (matches prior `PublishWorkspacePage`); the
 * host still uses floating preview for that path.
 */
const PLAYGROUND_WIDGET_PREVIEW_MOUNT_ID = 'playground-widget-preview-root';

export function PlaygroundLayout() {
  const { pathname } = useLocation();
  const isDeployRoute = /\/playground\/deploy\/?$/.test(pathname);

  return (
    <WidgetPreviewContainer
      previewMountId={PLAYGROUND_WIDGET_PREVIEW_MOUNT_ID}
      previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
      previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
      previewBodyClassName="min-h-0 px-2 py-2 sm:px-3 sm:py-2.5"
      preview={
        isDeployRoute
          ? undefined
          : ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
      }
    >
      <Outlet />
    </WidgetPreviewContainer>
  );
}
