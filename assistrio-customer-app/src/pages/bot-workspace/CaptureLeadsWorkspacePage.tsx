import { CaptureLeadsSection } from './CaptureLeadsSection';
import { CaptureLeadsWorkspaceProvider } from './CaptureLeadsWorkspaceContext';

export function CaptureLeadsWorkspacePage() {
  return (
    <CaptureLeadsWorkspaceProvider>
      <CaptureLeadsSection />
    </CaptureLeadsWorkspaceProvider>
  );
}
