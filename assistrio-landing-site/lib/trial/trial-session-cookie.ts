/** httpOnly cookie set after successful magic-link verify. Path `/` so the browser sends it on marketing routes too — `validateTrialDashboardSession` in the root layout can read it on `/`, `/about`, etc. */
export const TRIAL_SESSION_COOKIE_NAME = "assistrio_trial_session";

export const TRIAL_SESSION_COOKIE_PATH = "/";
