import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI, { APIError } from 'openai';
import { toFile } from 'openai/uploads';

function summarizeOpenAiTranscriptionErr(err: unknown): string {
  if (err instanceof APIError) {
    const chunks: string[] = [`http=${String(err.status)}`];
    if (typeof err.code === 'string' && err.code.trim()) chunks.push(`code=${err.code}`);
    if (typeof err.type === 'string' && err.type.trim()) chunks.push(`type=${err.type}`);
    if (err.message?.trim()) chunks.push(`detail=${err.message.trim().slice(0, 320)}`);
    if (typeof err.request_id === 'string' && err.request_id.trim()) chunks.push(`req=${err.request_id}`);
    return chunks.join(' ');
  }

  /** When `instanceof APIError` is false (e.g. duplicate `openai` package), still surface API body. */
  if (err !== null && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const nested =
      e.error !== null && typeof e.error === 'object' ? (e.error as Record<string, unknown>) : undefined;
    const nestedMsg =
      nested && typeof nested.message === 'string' ? nested.message.trim().slice(0, 320) : '';
    const topMsg = typeof e.message === 'string' ? e.message.trim().slice(0, 320) : '';
    const detail = nestedMsg || topMsg;
    if (typeof e.status === 'number' || detail || typeof e.code === 'string') {
      const chunks: string[] =
        typeof e.status === 'number' ? [`http=${String(e.status)}`] : ['http=?'];
      if (typeof e.code === 'string' && e.code.trim()) chunks.push(`code=${e.code}`);
      if (detail) chunks.push(`detail=${detail}`);
      return chunks.join(' ');
    }
  }

  if (err instanceof Error) return err.message.slice(0, 400);
  return String(err).slice(0, 400);
}

@Injectable()
export class WhisperTranscriptionService {
  private readonly log = new Logger(WhisperTranscriptionService.name);

  async transcribe(buffer: Buffer, filename: string, mimeType: string, apiKey: string): Promise<string> {
    const openai = new OpenAI({ apiKey });
    const file = await toFile(buffer, filename, { type: mimeType || 'application/octet-stream' });
    try {
      const result = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });
      return String(result.text ?? '').trim();
    } catch (err: unknown) {
      const status =
        typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : undefined;
      const safeName = filename.length > 120 ? `${filename.slice(0, 117)}...` : filename;
      const summary = summarizeOpenAiTranscriptionErr(err);
      this.log.warn(`Whisper transcription failed file=${safeName} mime=${mimeType || '?'} ${summary}`);
      if (status === 400) {
        throw new HttpException(
          {
            error: 'Could not transcribe this recording. Please try again.',
            errorCode: 'TRANSCRIPTION_REJECTED',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        {
          error: 'Could not transcribe this recording. Please try again.',
          errorCode: 'TRANSCRIPTION_FAILED',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
