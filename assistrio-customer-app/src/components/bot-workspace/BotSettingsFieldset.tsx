import type { ReactNode } from 'react';

/** Disables descendant form controls when the user cannot manage the bot. Do not wrap navigation/tab controls. */
export function BotSettingsFieldset({ canManage, children }: { canManage: boolean; children: ReactNode }) {
  if (canManage) return <>{children}</>;
  return (
    <fieldset disabled className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}
