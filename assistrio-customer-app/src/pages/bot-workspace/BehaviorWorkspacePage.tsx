import { BehaviorSection } from './BehaviorSection';

/** `BehaviorWorkspaceProvider` wraps the playground in `PlaygroundLayout` so all sections share one behavior draft. */
export function BehaviorWorkspacePage() {
  return <BehaviorSection />;
}
