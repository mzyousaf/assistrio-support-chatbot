export const allowedCorsOrigins = [
  "http://localhost:3001"
].filter((value): value is string => typeof value === "string" && value.length > 0);

function isAsstrioDomain(hostname: string): boolean {
  return hostname === "asstrio.com" || hostname.endsWith(".asstrio.com");
}

export function isAllowedCorsOrigin(origin: string | null): origin is string {
  if (!origin) {
    return false;
  }

  if (allowedCorsOrigins.includes(origin)) {
    return true;
  }

  if (/^http:\/\/localhost:\d+$/.test(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    return isHttp && isAsstrioDomain(url.hostname);
  } catch {
    return false;
  }
}

export function buildCorsHeaders(origin: string, methods: string = "POST, OPTIONS"): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
