import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { WhisperTranscriptionService } from '../transcription/whisper-transcription.service';
import { probeAudioForWhisperExtension } from '../chat/widget-speech-audio-validate.util';
import { normalizeWhisperUploadForOpenai } from '../chat/widget-speech-whisper-normalize.util';

const ONBOARDING_DICTATION_MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_AUDIO_MIME = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/oga',
  'audio/mp3',
  'audio/flac',
  'audio/x-flac',
  'video/webm',
  'application/octet-stream',
]);

type MultipartRequest = FastifyRequest & {
  isMultipart: () => boolean;
  parts: () => AsyncIterable<{
    type: string;
    fieldname?: string;
    filename?: string;
    mimetype?: string;
    toBuffer: () => Promise<Buffer>;
  }>;
};

function whisperExtensionLower(filename: string): string {
  const t = String(filename ?? '').trim();
  const i = t.lastIndexOf('.');
  if (i < 0) return '';
  return t.slice(i + 1).toLowerCase();
}

@Injectable()
export class WorkspaceOnboardingDictationService {
  private readonly log = new Logger(WorkspaceOnboardingDictationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whisper: WhisperTranscriptionService,
  ) {}

  private resolveWhisperApiKey(): string {
    const cfg = String(this.configService.get<string>('openaiApiKey') ?? '').trim();
    if (!cfg) {
      throw new HttpException(
        { error: 'Speech transcription is not configured.', errorCode: 'transcription_unavailable' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return cfg;
  }

  async transcribeDescribeAgent(req: FastifyRequest): Promise<{ text: string }> {
    const r = req as MultipartRequest;
    if (!r.isMultipart()) {
      throw new HttpException(
        { error: 'Expected multipart/form-data with field "file".', errorCode: 'bad_request' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let buffer: Buffer | null = null;
    let filename = 'recording.webm';
    let mime = 'audio/webm';

    for await (const part of r.parts()) {
      if (part.type !== 'file') continue;
      if (part.fieldname !== 'file') {
        throw new HttpException(
          { error: 'Unexpected file field. Use field name "file".', errorCode: 'bad_request' },
          HttpStatus.BAD_REQUEST,
        );
      }
      buffer = await part.toBuffer();
      filename = (part.filename || filename).trim() || filename;
      const partMime = String(part.mimetype ?? '').trim();
      if (partMime && ALLOWED_AUDIO_MIME.has(partMime.toLowerCase())) {
        mime = partMime.split(';')[0]!.trim();
      }
    }

    if (!buffer?.length) {
      throw new HttpException(
        { error: 'Missing audio file. Send a multipart field named "file".', errorCode: 'bad_request' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (buffer.length > ONBOARDING_DICTATION_MAX_BYTES) {
      throw new HttpException(
        {
          error: 'Audio file is too large (max 4 MB).',
          errorCode: 'file_too_large',
          maxBytes: ONBOARDING_DICTATION_MAX_BYTES,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const normalized = normalizeWhisperUploadForOpenai({ filename, mime });
    if (!normalized.ok) {
      throw new HttpException(
        { error: normalized.errorMessage, errorCode: 'unsupported_audio_type' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const extProbe = whisperExtensionLower(normalized.filename) || 'webm';
    const probe = probeAudioForWhisperExtension(buffer, extProbe);
    if (!probe.ok) {
      this.log.warn(`[onboarding-dictation] Rejected audio probe=${probe.reason} bytes=${buffer.length}`);
      throw new HttpException(
        { error: 'Invalid or empty audio recording. Please try again.', errorCode: 'invalid_audio_upload' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const apiKey = this.resolveWhisperApiKey();
    const text = await this.whisper.transcribe(buffer, normalized.filename, normalized.mime, apiKey);
    if (!text) {
      throw new HttpException(
        { error: 'No speech detected.', errorCode: 'empty_transcript' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { text };
  }
}
