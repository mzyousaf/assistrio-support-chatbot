export type EmbedInitFailureIconKind = "not_found" | "forbidden" | "network" | "generic";

function isLikelyNetworkFailureMessage(message: string): boolean {
  const m = (message || "").trim().toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m === "fetcherror"
  );
}

/**
 * Mirrors `resolveIframeChatFailurePresentation` in the customer app so embed init errors
 * match the dashboard “couldn’t load this chat” card UX.
 */
export function resolveEmbedInitFailurePresentation(errorText: string): {
  title: string;
  description: string;
  icon: EmbedInitFailureIconKind;
} {
  const m = (errorText || "").trim();
  const isOriginBlocked = /not allowed|forbidden|origin|referer|invalid/i.test(m);

  if (isOriginBlocked) {
    return {
      title: "This chatbot is not allowed on this site",
      description:
        m || "Add your site’s origin under Allowed origins in Deploy & Go Live, then try again.",
      icon: "forbidden",
    };
  }

  if (isLikelyNetworkFailureMessage(m)) {
    return {
      title: "We couldn't load this chat",
      description:
        "Your browser could not reach our servers. Check your connection, wait a moment, and try again. VPNs and some corporate networks block requests.",
      icon: "network",
    };
  }

  return {
    title: "Something went wrong",
    description: m || "We could not load this chat. Please try again.",
    icon: "generic",
  };
}
