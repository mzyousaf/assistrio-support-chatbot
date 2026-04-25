import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { EmbedSessionService } from '../bots/embed-session.service';
import { validateRuntimeBotAccess } from '../bots/runtime-bot-access.util';
import { toRuntimeCredentialErrorCode } from '../bots/runtime-error-codes.util';
import {
  coerceAllowedOriginsFromBotDoc,
  isRuntimeOriginAllowed,
  resolveRuntimeEmbedOriginFromHeaders,
} from '../bots/origin-validation.util';
import { resolveEmbedChatVisitorIdFromBody } from '../bots/widget-embed-identity.util';
import { uploadPublic } from '../lib/s3';
import { WhisperTranscriptionService } from './whisper-transcription.service';

const WIDGET_SPEECH_MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_SPEECH_MIME = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'application/octet-stream',
]);

type SpeechMode = 'dictate' | 'voice';

export type WidgetSpeechResult = {
  transcript: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs?: number;
};

export type ParsedWidgetSpeechMultipart = {
  buffer: Buffer;
  filename: string;
  mime: string;
  botId: string;
  mode: SpeechMode;
  chatVisitorId?: string;
  visitorId?: string;
  accessKey?: string;
  secretKey?: string;
  authToken?: string;
  durationMs?: number;
};

@Injectable()
export class WidgetSpeechService {
  constructor(
    private readonly configService: ConfigService,
    private readonly botsService: BotsService,
    private readonly embedSessionService: EmbedSessionService,
    private readonly whisper: WhisperTranscriptionService,
  ) {}

  private resolveWhisperApiKey(bot: Record<string, unknown>): string {
    const w = String((bot as { whisperApiKeyOverride?: unknown }).whisperApiKeyOverride ?? '').trim();
    const o = String((bot as { openaiApiKeyOverride?: unknown }).openaiApiKeyOverride ?? '').trim();
    const cfg = String(this.configService.get<string>('openaiApiKey') ?? '').trim();
    return w || o || cfg;
  }

  private assertSpeechEnabled(bot: Record<string, unknown>): void {
    const chatUI = (bot.chatUI ?? {}) as Record<string, unknown>;
    const showMic = chatUI.showMic === true;
    const showVoice =
      typeof chatUI.showVoice === 'boolean' ? chatUI.showVoice === true : showMic;
    if (!showMic && !showVoice) {
      throw new HttpException(
        { error: 'Speech input is disabled for this bot', errorCode: 'SPEECH_DISABLED' },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertRuntimeAccess(
    req: FastifyRequest,
    bot: Record<string, unknown>,
    creds: { accessKey?: string; secretKey?: string },
    chatVisitorId: string,
  ): void {
    const botId = String(bot._id ?? '');
    if (this.embedSessionService.verifyRequestForBot(req, botId, chatVisitorId)) {
      return;
    }
    const access = validateRuntimeBotAccess(
      {
        status: (bot.status as string | undefined) ?? undefined,
        visibility: (bot.visibility as 'public' | 'private' | undefined) ?? undefined,
        accessKey: (bot.accessKey as string | undefined) ?? undefined,
        secretKey: (bot.secretKey as string | undefined) ?? undefined,
      },
      creds,
    );
    if (!access.ok) {
      throw new HttpException(
        {
          error: 'Invalid bot access credentials',
          errorCode: toRuntimeCredentialErrorCode(access),
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertRuntimeOrigin(bot: Record<string, unknown>, req: FastifyRequest): void {
    const nodeEnv = this.configService.get<string>('nodeEnv') ?? 'development';
    const embedOriginResolved = resolveRuntimeEmbedOriginFromHeaders(req.headers);
    if (!embedOriginResolved) {
      throw new HttpException(
        {
          error: 'Origin header is required for embed requests',
          errorCode: 'EMBED_ORIGIN_HEADER_REQUIRED',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const allowedOrigins = coerceAllowedOriginsFromBotDoc(bot.allowedOrigins);
    if (!isRuntimeOriginAllowed(embedOriginResolved, allowedOrigins, nodeEnv)) {
      throw new HttpException(
        { error: 'This chat widget is not allowed on this site', errorCode: 'EMBED_ORIGIN_NOT_ALLOWED' },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async parseMultipart(req: FastifyRequest): Promise<ParsedWidgetSpeechMultipart> {
    if (!req.isMultipart()) {
      throw new HttpException(
        { error: 'Expected multipart/form-data with field "file" and "botId".', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let buffer: Buffer | null = null;
    let filename = 'recording.webm';
    let mime = 'audio/webm';
    let botId = '';
    let mode: SpeechMode | null = null;
    let chatVisitorId = '';
    let visitorId = '';
    let accessKey = '';
    let secretKey = '';
    let authToken = '';
    let durationMs: number | undefined;

    try {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            throw new HttpException(
              { error: 'Unexpected file field. Use field name "file".', errorCode: 'BAD_REQUEST' },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (buffer !== null) {
            throw new HttpException(
              { error: 'Only one file is allowed per request.', errorCode: 'BAD_REQUEST' },
              HttpStatus.BAD_REQUEST,
            );
          }
          buffer = await part.toBuffer();
          filename = (part.filename || 'recording.webm').trim() || 'recording.webm';
          const m = part.mimetype?.toLowerCase() ?? '';
          mime = m || 'audio/webm';
        } else if (part.type === 'field') {
          const fieldname = part.fieldname;
          const val = String((part as { value?: unknown }).value ?? '').trim();
          if (fieldname === 'botId') botId = val;
          else if (fieldname === 'mode' && (val === 'dictate' || val === 'voice')) mode = val;
          else if (fieldname === 'chatVisitorId') chatVisitorId = val;
          else if (fieldname === 'visitorId') visitorId = val;
          else if (fieldname === 'accessKey') accessKey = val;
          else if (fieldname === 'secretKey') secretKey = val;
          else if (fieldname === 'authToken') authToken = val;
          else if (fieldname === 'durationMs') {
            const n = Number(val);
            if (Number.isFinite(n) && n >= 0) durationMs = Math.min(Math.round(n), 3_600_000);
          }
        }
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const err = e as { statusCode?: number; code?: string };
      if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
        throw new HttpException(
          { error: 'Audio too large', maxBytes: WIDGET_SPEECH_MAX_BYTES, errorCode: 'PAYLOAD_TOO_LARGE' },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw new HttpException({ error: 'Upload failed', errorCode: 'BAD_REQUEST' }, HttpStatus.BAD_REQUEST);
    }

    if (!buffer?.length || !botId || !Types.ObjectId.isValid(botId) || !mode) {
      throw new HttpException(
        { error: 'Missing file, botId, or mode (dictate|voice).', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (buffer.length > WIDGET_SPEECH_MAX_BYTES) {
      throw new HttpException(
        { error: 'Audio too large', maxBytes: WIDGET_SPEECH_MAX_BYTES, errorCode: 'PAYLOAD_TOO_LARGE' },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const mimeBase = mime.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!ALLOWED_SPEECH_MIME.has(mime.toLowerCase()) && !ALLOWED_SPEECH_MIME.has(mimeBase)) {
      throw new HttpException(
        { error: 'Unsupported audio type', errorCode: 'UNSUPPORTED_MEDIA' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      buffer,
      filename,
      mime: mimeBase || mime,
      botId,
      mode,
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(visitorId ? { visitorId } : {}),
      ...(accessKey ? { accessKey } : {}),
      ...(secretKey ? { secretKey } : {}),
      ...(authToken ? { authToken } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };
  }

  private async runTranscribeAndMaybeUpload(
    bot: Record<string, unknown>,
    parsed: ParsedWidgetSpeechMultipart,
  ): Promise<WidgetSpeechResult> {
    const apiKey = this.resolveWhisperApiKey(bot);
    if (!apiKey) {
      throw new HttpException(
        { error: 'Speech transcription is not configured for this bot', errorCode: 'WHISPER_KEY_MISSING' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const transcript = await this.whisper.transcribe(parsed.buffer, parsed.filename, parsed.mime, apiKey);
    if (!transcript) {
      throw new HttpException({ error: 'No speech detected', errorCode: 'EMPTY_TRANSCRIPT' }, HttpStatus.BAD_REQUEST);
    }

    if (parsed.mode === 'dictate') {
      return {
        transcript,
        mimeType: parsed.mime,
        ...(parsed.durationMs !== undefined ? { durationMs: parsed.durationMs } : {}),
      };
    }

    const ext =
      parsed.mime.includes('wav') ? 'wav' : parsed.mime.includes('mpeg') || parsed.mime.includes('mp3')
        ? 'mp3'
        : parsed.mime.includes('mp4') || parsed.mime.includes('m4a')
          ? 'm4a'
          : 'webm';
    const keyPrefix = `uploads/widget-voice/${parsed.botId}`;
    try {
      const uploaded = await uploadPublic({
        prefix: keyPrefix,
        originalName: `${randomUUID()}.${ext}`,
        contentType: parsed.mime || `audio/${ext}`,
        body: parsed.buffer,
      });
      return {
        transcript,
        audioUrl: uploaded.url,
        mimeType: parsed.mime,
        ...(parsed.durationMs !== undefined ? { durationMs: parsed.durationMs } : {}),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[widget-speech] S3 upload failed', { botId: parsed.botId, msg });
      throw new HttpException(
        { error: 'Voice storage is not available. Try again later.', errorCode: 'STORAGE_UNAVAILABLE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async handleRuntime(req: FastifyRequest): Promise<WidgetSpeechResult> {
    const parsed = await this.parseMultipart(req);
    const bot = await this.botsService.findOneByIdForExternalRuntime(parsed.botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const b = bot as Record<string, unknown>;
    if ((b.status as string | undefined) !== 'published') {
      throw new HttpException({ error: 'Bot not available', errorCode: 'BOT_NOT_PUBLISHED' }, HttpStatus.NOT_FOUND);
    }
    this.assertSpeechEnabled(b);

    const resolvedChatVisitorId = resolveEmbedChatVisitorIdFromBody(parsed.chatVisitorId, parsed.visitorId);
    if (!resolvedChatVisitorId) {
      throw new HttpException(
        { error: 'chatVisitorId is required', errorCode: 'CHAT_VISITOR_ID_REQUIRED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertRuntimeAccess(
      req,
      b,
      { accessKey: parsed.accessKey, secretKey: parsed.secretKey },
      resolvedChatVisitorId,
    );
    this.assertRuntimeOrigin(b, req);

    const ownerId = b.ownerId;
    if (ownerId == null || String(ownerId).trim() === '') {
      throw new HttpException(
        { error: 'Bot is missing workspace ownership', errorCode: 'BOT_OWNER_REQUIRED' },
        HttpStatus.FORBIDDEN,
      );
    }

    return this.runTranscribeAndMaybeUpload(b, parsed);
  }

  /** After `parseMultipart` + `verifyPreviewOwnerOrThrow` in the preview controller. */
  async handlePreview(bot: Record<string, unknown>, parsed: ParsedWidgetSpeechMultipart): Promise<WidgetSpeechResult> {
    this.assertSpeechEnabled(bot);
    if (parsed.botId !== String(bot._id ?? '')) {
      throw new HttpException({ error: 'botId mismatch', errorCode: 'BAD_REQUEST' }, HttpStatus.BAD_REQUEST);
    }
    return this.runTranscribeAndMaybeUpload(bot, parsed);
  }
}
