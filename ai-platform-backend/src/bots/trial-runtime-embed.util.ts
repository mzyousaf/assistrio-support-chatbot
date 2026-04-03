/**
 * Runtime embed: trial bots must send {@link resolvedPlatformVisitorId} equal to {@link Bot.ownerVisitorId}.
 */
export function trialRuntimePlatformVisitorMatchesOwner(params: {
  ownerVisitorId: unknown;
  resolvedPlatformVisitorId: string;
}): boolean {
  const owner = String(params.ownerVisitorId ?? '').trim();
  const pv = String(params.resolvedPlatformVisitorId ?? '').trim();
  return !!owner && !!pv && owner === pv;
}
