/**
 * Runtime embed chat with file attachments: multipart POST (field `payload` + `file` parts).
 * Same cookie + 403 key retry behavior as {@link runtimeEmbedSpeechPost}.
 */
export async function runtimeEmbedMultipartPost(
  url: string,
  buildForm: (includeKeys: boolean) => FormData,
  keys: { accessKey?: string; secretKey?: string },
): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    body: buildForm(false),
    credentials: "include",
  });
  if (res.ok || res.status !== 403) return res;
  const data = (await res.clone().json().catch(() => ({}))) as { errorCode?: string };
  const code = typeof data.errorCode === "string" ? data.errorCode : "";
  if (code !== "INVALID_ACCESS_KEY" && code !== "INVALID_SECRET_KEY") return res;
  if (!keys.accessKey && !keys.secretKey) return res;
  return fetch(url, {
    method: "POST",
    body: buildForm(true),
    credentials: "include",
  });
}
