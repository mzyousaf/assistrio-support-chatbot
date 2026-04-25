import type { MessageAttachment, MessageSpeechInput } from '../models/message.schema';

/**
 * Text the model, RAG, and lead capture should use for a user turn.
 * Plain text: `content` only. Voice: prefer Whisper `speechInput.transcript` so the assistant
 * answers what was said, not a placeholder bubble label.
 * Attachments: append a machine-readable line with public URLs so the model knows what was shared.
 */
export function userMessageTextForLlm(
  content: string,
  speech?: MessageSpeechInput | null,
  attachments?: MessageAttachment[] | null,
): string {
  const trimmed = (content ?? '').trim();
  let base: string;
  if (speech?.mode === 'voice') {
    const tr = speech.transcript?.trim();
    base = tr || trimmed;
  } else {
    base = trimmed;
  }
  if (attachments?.length) {
    const list = attachments
      .map((a) => `${(a.name || 'file').trim()}: ${(a.url || '').trim()}`)
      .join('; ');
    const block = `[Attached files: ${list}]`;
    if (base.trim()) return `${base.trim()}\n\n${block}`;
    return block;
  }
  return base;
}
