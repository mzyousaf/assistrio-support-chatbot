import type { EmbedChatConfig, WidgetInitRequest, WidgetInitResponse } from "./types";
import { normalizeEmbedConfig } from "./config";

function buildWidgetInitUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl}/api/widget/init`;
}

function toInitRequest(config: EmbedChatConfig): WidgetInitRequest {
  return {
    botId: config.botId,
    ...(config.accessKey ? { accessKey: config.accessKey } : {}),
  };
}

/** Merge fetch headers: defaults apply first; override can replace keys (e.g. Content-Type). */
function mergeHeaders(
  defaults: HeadersInit,
  override?: HeadersInit
): Headers {
  const merged = new Headers(defaults);
  if (override == null) return merged;
  const extra = new Headers(override);
  extra.forEach((value, key) => {
    merged.set(key, value);
  });
  return merged;
}

export async function validateAndInitWidget(
  rawConfig: Partial<EmbedChatConfig>,
  init?: RequestInit
): Promise<WidgetInitResponse> {
  const config = normalizeEmbedConfig(rawConfig);
  const url = buildWidgetInitUrl(config.apiBaseUrl);
  const body = toInitRequest(config);

  const { headers: overrideHeaders, ...restInit } = init ?? {};
  const headers = mergeHeaders({ "Content-Type": "application/json" }, overrideHeaders);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    ...restInit,
  });

  let data: WidgetInitResponse | null = null;
  try {
    data = (await response.json()) as WidgetInitResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const code = typeof data?.errorCode === "string" ? data.errorCode : "";
    const message =
      data?.error ||
      `Widget init failed with status ${response.status}`;
    throw new Error(code ? `${message} (${code})` : message);
  }

  if (!data) {
    throw new Error("Widget init failed: empty response.");
  }

  if (data.status === "error") {
    const code = typeof data.errorCode === "string" ? data.errorCode : "";
    const message = data.error ?? "Widget init failed.";
    throw new Error(code ? `${message} (${code})` : message);
  }

  return data;
}

