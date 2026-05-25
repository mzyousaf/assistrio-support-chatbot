/**
 * Mirrors `resolveEmbedInitFailurePresentation` in the customer app so embed init errors
 * match the dashboard “couldn’t load this chat” card UX.
 */
export function resolveEmbedInitFailurePresentation(errorText: string): {
  title: string;
  description: string;
  icon: EmbedInitFailureIconKind;
} {
  const m = (errorText || "").trim();

  if (
    m.includes("workspace_bot_preview_access_denied") ||
    /don't have permission to preview this agent/i.test(m)
  ) {
    const description =
      m.replace(/\s*\(workspace_bot_preview_access_denied\)\s*$/i, "").trim() ||
      "You don't have permission to preview this agent. Ask a workspace owner or admin for access.";
    return {
      title: "Preview access denied",
      description,
      icon: "forbidden",
    };
  }

  if (m.includes("PREVIEW_FORBIDDEN") || /only available to the bot owner/i.test(m)) {
    const description =
      m.replace(/\s*\(PREVIEW_FORBIDDEN\)\s*$/i, "").trim() ||
      "Preview is only available to the bot owner. Sign in as the account that owns this agent.";
    return {
      title: "Preview not available",
      description,
      icon: "forbidden",
    };
  }

  const isOriginBlocked =
    m.includes("PREVIEW_ORIGIN_NOT_ALLOWED") ||
    m.includes("EMBED_DOMAIN_NOT_ALLOWED") ||
    m.includes("EMBED_ORIGIN_REQUIRED") ||
    m.includes("EMBED_ORIGIN_INVALID") ||
    m.includes("EMBED_NO_ALLOWLIST") ||
    (/not allowed on this site/i.test(m) && !/preview/i.test(m));

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

export type EmbedInitFailureIconKind = "not_found" | "forbidden" | "network" | "generic";

function isLikelyNetworkFailureMessage(message: string): boolean {
  const lower = (message || "").trim().toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower === "fetcherror"
  );
}
