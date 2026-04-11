/** S3 path segment used for trial onboarding / playground avatar uploads. */
export function isTrialHostedAvatarObjectUrl(url: string): boolean {
  return url.trim().toLowerCase().includes("trial-onboarding/avatars");
}
