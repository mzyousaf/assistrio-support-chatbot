/** Site-wide default Assistrio widget (landing page + restore after preview). */
const DEFAULT_BOT_ID = "69bcbc1470937e67f6163506";
const DEFAULT_API_BASE =
  "https://erythrismal-giovanni-unscorching.ngrok-free.dev";

export type AssistrioChatConfigShape = {
  botId: string;
  apiBaseUrl: string;
  position: "right";
};

export function getLandingAssistrioChatConfig(): AssistrioChatConfigShape {
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

  return {
    botId,
    apiBaseUrl,
    position: "right",
  };
}
