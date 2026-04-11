/**
 * Client-safe display hints for a validated trial dashboard session (built on the server).
 */

export type TrialSessionBadgeInput = {
  name?: string;
  emailNormalized: string;
  /** When set, UI can show `aw_<id>` in the account control. */
  platformVisitorId?: string;
};

export type TrialSessionClientPayload = {
  initials: string;
  displayName: string;
  /** Shown in account menus (marketing + workspace). */
  emailNormalized?: string;
  /** e.g. `aw_<platformVisitorId>` — under the display name in the account control. */
  workspaceIdLabel?: string;
};

export function buildTrialSessionClientPayload(input: TrialSessionBadgeInput): TrialSessionClientPayload {
  const email = input.emailNormalized.trim();
  const name = input.name?.trim();

  let initials = "?";
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0];
      const b = parts[parts.length - 1][0];
      if (a && b) initials = (a + b).toUpperCase();
    } else if (parts[0]?.length >= 2) {
      initials = parts[0].slice(0, 2).toUpperCase();
    } else if (parts[0]?.length === 1) {
      initials = (parts[0] + parts[0]).toUpperCase();
    }
  }
  if (initials === "?" && email.length >= 2) {
    const local = email.split("@")[0] ?? email;
    initials = local.slice(0, 2).toUpperCase();
  }

  const displayName = name || email.split("@")[0] || "Trial workspace";

  const pv = input.platformVisitorId?.trim();
  const workspaceIdLabel = pv ? `aw_${pv}` : undefined;

  return { initials, displayName, emailNormalized: email, workspaceIdLabel };
}
