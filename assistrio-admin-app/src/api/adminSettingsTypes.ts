export type AdminOpenAiTestPlatformKeyResponse = {
  ok: true;
  message?: string;
};

export type AdminOpenAiTestKeyResponse = {
  ok: true;
};

export type BackendHealthResponse = {
  status: string;
  timestamp?: string;
  responseTimeMs: number;
};
