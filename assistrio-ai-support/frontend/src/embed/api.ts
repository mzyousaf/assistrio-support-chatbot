import type { EmbedChatConfig, WidgetInitRequest, WidgetInitResponse } from "./types";
import { normalizeEmbedConfig } from "./config";

function buildWidgetInitUrl(apiBaseUrl: string, mode: "runtime" | "preview"): string {
  return mode === "preview"
    ? `${apiBaseUrl}/api/widget/preview/init`
    : `${apiBaseUrl}/api/widget/init`;
}

function resolvePathWithBase(apiBaseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBaseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function toInitRequest(config: EmbedChatConfig): WidgetInitRequest {
  if ((config.mode ?? "runtime") === "preview") {
    return {
      botId: config.botId,
      mode: "preview",
      ...(config.platformVisitorId ? { platformVisitorId: config.platformVisitorId } : {}),
      ...(config.chatVisitorId ? { chatVisitorId: config.chatVisitorId } : {}),
      ...(config.authToken ? { authToken: config.authToken } : {}),
      ...(config.previewOverrides ? { previewOverrides: config.previewOverrides } : {}),
      ...(config.accessKey ? { accessKey: config.accessKey } : {}),
      ...(config.secretKey ? { secretKey: config.secretKey } : {}),
    };
  }
  return {
    botId: config.botId,
    mode: "runtime",
    ...(config.accessKey ? { accessKey: config.accessKey } : {}),
    ...(config.secretKey ? { secretKey: config.secretKey } : {}),
    ...(config.chatVisitorId ? { chatVisitorId: config.chatVisitorId } : {}),
  };
}

function mergeHeaders(defaults: HeadersInit, override?: HeadersInit): Headers {
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
  init?: RequestInit,
): Promise<WidgetInitResponse> {
  const config = normalizeEmbedConfig(rawConfig);
  const mode = config.mode ?? "runtime";
  const url = config.widgetInitPath
    ? resolvePathWithBase(config.apiBaseUrl, config.widgetInitPath)
    : buildWidgetInitUrl(config.apiBaseUrl, mode);
  const body = toInitRequest(config);

  const { headers: overrideHeaders, ...restInit } = init ?? {};
  const headers = mergeHeaders({ "Content-Type": "application/json" }, overrideHeaders);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    ...restInit,
    credentials: "include",
  });

  let data: WidgetInitResponse | null = null;
  try {
    data = (await response.json()) as WidgetInitResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const code = typeof data?.errorCode === "string" ? data.errorCode : "";
    const message = data?.error || `Widget init failed with status ${response.status}`;
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
