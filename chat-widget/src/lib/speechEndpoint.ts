/** Derive multipart speech URL from the JSON chat POST URL. */
export function speechEndpointFromChatUrl(chatUrl: string): string {
  const u = chatUrl.replace(/\/$/, "");
  if (u.endsWith("/message")) return `${u.slice(0, -"/message".length)}/speech`;
  if (u.endsWith("/chat")) return `${u.slice(0, -"/chat".length)}/speech`;
  return `${u}/speech`;
}
