/** Site-wide default Assistrio widget (landing page + restore after preview). */
const DEFAULT_BOT_ID = "69bcbc1470937e67f6163506";
const DEFAULT_API_BASE =
  "https://erythrismal-giovanni-unscorching.ngrok-free.dev";

export type AssistrioChatConfigShape = {
  botId: string;
  apiBaseUrl: string;
  accessKey: string;
  position: "right";
};

export function getLandingAssistrioChatConfig(): AssistrioChatConfigShape | null {
  const botId =
    typeof process.env.NEXT_PUBLIC_LANDING_WIDGET_BOT_ID === "string" &&
      process.env.NEXT_PUBLIC_LANDING_WIDGET_BOT_ID.trim() !== ""
      ? process.env.NEXT_PUBLIC_LANDING_WIDGET_BOT_ID.trim()
      : DEFAULT_BOT_ID;

  const raw =
    typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string"
      ? process.env.NEXT_PUBLIC_API_BASE_URL.trim()
      : "";
  const apiBaseUrl = raw !== "" ? raw.replace(/\/$/, "") : DEFAULT_API_BASE;
  const accessKey =
    typeof process.env.NEXT_PUBLIC_LANDING_WIDGET_ACCESS_KEY === "string"
      ? process.env.NEXT_PUBLIC_LANDING_WIDGET_ACCESS_KEY.trim()
      : "";

  // Runtime hardening: external widget contract requires accessKey for public bots.
  // Graceful fallback for missing env in non-widget environments.
  if (!accessKey) {
    return null;
  }

  return {
    botId,
    apiBaseUrl,
    accessKey,
    position: "right",
  };
}
