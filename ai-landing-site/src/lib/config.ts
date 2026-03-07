/** Backend base URL – all API requests and trial/demo links use this (no dependency on platform app). */
const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
export const API_BASE_URL =
  typeof raw === "string" && raw.trim() !== ""
    ? raw.trim().replace(/\/$/, "")
    : "";
