import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  buildResponseStyleRefineUserPrompt,
  parseResponseStyleRefineJson,
  refineResponseStyleDeterministic,
  softenMaliciousStyleDescription,
  type ResponseStyleRefineResult,
} from './response-style-refine.util';

const REFINE_MODEL = 'gpt-4.1-mini';

@Injectable()
export class ResponseStyleRefineService {
  constructor(private readonly config: ConfigService) {}

  async refine(description: string, apiKey?: string): Promise<ResponseStyleRefineResult> {
    const normalized = String(description ?? '').trim();
    if (!normalized) {
      throw new Error('description_required');
    }
    if (normalized.length > 1000) {
      throw new Error('description_too_long');
    }

    const softened = softenMaliciousStyleDescription(normalized);
    const deterministic = refineResponseStyleDeterministic(softened);
    if (deterministic) return deterministic;

    const resolvedKey =
      (apiKey ?? '').trim() || String(this.config.get<string>('openaiApiKey') ?? '').trim();
    if (!resolvedKey) {
      throw new Error('missing_openai_key');
    }

    const openai = new OpenAI({ apiKey: resolvedKey });
    const completion = await openai.chat.completions.create({
      model: REFINE_MODEL,
      temperature: 0.15,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You convert customer response-format preferences into strict assistant formatting rules. Output JSON only.',
        },
        { role: 'user', content: buildResponseStyleRefineUserPrompt(softened) },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = parseResponseStyleRefineJson(raw, softened);
    if (!parsed) {
      throw new Error('refine_parse_failed');
    }
    return parsed;
  }
}
