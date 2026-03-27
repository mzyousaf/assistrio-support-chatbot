/**
 * Automatic conversation summary generation for long chats.
 * Updates conversation.summary periodically (e.g. every 8 messages) via LLM.
 * Safe: on failure, returns null and does not break chat.
 */

const SUMMARY_MODEL = 'gpt-4.1-mini';
const SUMMARY_MAX_TOKENS = 300;

export interface SummaryInput {
  messages: Array<{ role: string; content: string }>;
  previousSummary?: string;
  capturedLeadData?: Record<string, string>;
}

/**
 * Generate a short summary of the conversation: user intent, key facts, lead data, unresolved questions.
 * Returns null on any failure so chat is not broken.
 */
export async function generateConversationSummary(
  input: SummaryInput,
  apiKey: string,
): Promise<string | null> {
  if (!apiKey?.trim()) return null;
  const { messages, previousSummary, capturedLeadData } = input;
  if (!messages?.length) return null;

  const recent = messages.slice(-16).map((m) => `${m.role}: ${(m.content || '').slice(0, 500)}`).join('\n');
  const leadLine = capturedLeadData && Object.keys(capturedLeadData).length > 0
    ? `Collected lead info: ${Object.entries(capturedLeadData).map(([k, v]) => `${k}=${v}`).join('; ')}.`
    : '';

  const systemPrompt = 'You are a summarizer. Output a single short paragraph (2-4 sentences). No preamble.';
  const userPrompt = [
    previousSummary ? `Previous summary: ${previousSummary}\n\n` : '',
    'Recent messages:\n',
    recent,
    leadLine ? `\n\n${leadLine}` : '',
    '\n\nSummarize: main user intent, important facts shared, any lead data collected, and unresolved questions if any. Keep it concise.',
  ].join('');

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: SUMMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt.slice(0, 6000) },
      ],
      max_tokens: SUMMARY_MAX_TOKENS,
      temperature: 0.2,
    });
    const summary = completion.choices[0]?.message?.content?.trim();
    return summary && summary.length > 0 ? summary : null;
  } catch {
    return null;
  }
}

/** Message count interval at which to attempt summary update (e.g. every 8 messages). */
export const SUMMARY_UPDATE_INTERVAL = 8;

/** Minimum messages before first summary (avoid summarizing very short chats). */
export const SUMMARY_MIN_MESSAGES = 8;

export interface SummaryUpdateResult {
  eligible: boolean;
  attempted: boolean;
  generated: boolean;
  summary: string | null;
  /** Safe internal error for debug only (e.g. "timeout", "empty response"). */
  error?: string;
}

/**
 * Trigger summary update when eligible (every N messages).
 * Isolated so it can later be replaced by async/background execution.
 * TODO: Replace inline call with queue/job for off-request summary generation.
 */
export async function runConversationSummaryUpdate(
  totalMessagesNow: number,
  messagesForSummary: Array<{ role: string; content: string }>,
  previousSummary: string | undefined,
  capturedLeadData: Record<string, string>,
  apiKey: string,
): Promise<SummaryUpdateResult> {
  const eligible =
    totalMessagesNow >= SUMMARY_MIN_MESSAGES && totalMessagesNow % SUMMARY_UPDATE_INTERVAL === 0;
  if (!eligible || !apiKey?.trim()) {
    return { eligible, attempted: false, generated: false, summary: null };
  }
  try {
    const summary = await generateConversationSummary(
      { messages: messagesForSummary, previousSummary, capturedLeadData },
      apiKey,
    );
    return {
      eligible: true,
      attempted: true,
      generated: !!summary,
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const safe = message.slice(0, 80).replace(/[^\w\s-]/g, '');
    return {
      eligible: true,
      attempted: true,
      generated: false,
      summary: null,
      error: safe || 'unknown',
    };
  }
}
