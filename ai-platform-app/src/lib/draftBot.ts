export const DRAFT_BOT_KEY = "assistrio_superadmin_draft_bot_id";
export const SUPERADMIN_DRAFT_BOT_STORAGE_KEY = DRAFT_BOT_KEY;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getDraftId(): string | null {
  if (!isBrowser()) {
    return null;
  }
  const value = window.localStorage.getItem(DRAFT_BOT_KEY);
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function setDraftId(id: string): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(DRAFT_BOT_KEY, id);
}

export function clearDraftId(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(DRAFT_BOT_KEY);
}

function createDraftId(): string {
  if (!isBrowser() || typeof crypto === "undefined" || !crypto.randomUUID) {
    return "";
  }
  return crypto.randomUUID();
}

export function ensureDraftId(): string {
  const existing = getDraftId();
  if (existing) {
    return existing;
  }
  const nextId = createDraftId();
  if (nextId) {
    setDraftId(nextId);
  }
  return nextId;
}

export function rotateDraftId(): string {
  const nextId = createDraftId();
  if (nextId) {
    setDraftId(nextId);
  }
  return nextId;
}
