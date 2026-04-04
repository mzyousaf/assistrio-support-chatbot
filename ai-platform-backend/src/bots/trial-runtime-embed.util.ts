/**
 * Trial runtime embed: **identity / ownership** — `resolvedPlatformVisitorId` must match the bot’s
 * `ownerVisitorId`. Origin/domain allowlists are enforced separately; a matching domain never replaces id proof.
 */
export function trialRuntimePlatformVisitorMatchesOwner(params: {
  ownerVisitorId: unknown;
  resolvedPlatformVisitorId: string;
}): boolean {
  const owner = String(params.ownerVisitorId ?? '').trim();
  const pv = String(params.resolvedPlatformVisitorId ?? '').trim();
  return !!owner && !!pv && owner === pv;
}
