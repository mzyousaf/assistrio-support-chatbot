import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

@Injectable()
export class WhisperTranscriptionService {
  async transcribe(buffer: Buffer, filename: string, mimeType: string, apiKey: string): Promise<string> {
    const openai = new OpenAI({ apiKey });
    const file = await toFile(buffer, filename, { type: mimeType || 'application/octet-stream' });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });
    return String(result.text ?? '').trim();
  }
}
