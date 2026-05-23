import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceOnboardingDictationService } from './workspace-onboarding-dictation.service';
import { WhisperTranscriptionService } from '../transcription/whisper-transcription.service';

describe('WorkspaceOnboardingDictationService', () => {
  const whisper = { transcribe: jest.fn(async () => 'Hello from audio') };
  const config = { get: jest.fn(() => 'test-openai-key') };

  function service() {
    return new WorkspaceOnboardingDictationService(
      config as unknown as ConfigService,
      whisper as unknown as WhisperTranscriptionService,
    );
  }

  it('rejects non-multipart requests', async () => {
    const req = { isMultipart: () => false } as never;
    await expect(service().transcribeDescribeAgent(req)).rejects.toThrow(HttpException);
  });

  it('transcribes valid multipart audio', async () => {
    const webmHead = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    const buffer = Buffer.concat([webmHead, Buffer.alloc(2048, 0)]);
    const req = {
      isMultipart: () => true,
      parts: async function* () {
        yield {
          type: 'file',
          fieldname: 'file',
          filename: 'clip.webm',
          mimetype: 'audio/webm',
          toBuffer: async () => buffer,
        };
      },
    } as never;

    const result = await service().transcribeDescribeAgent(req);
    expect(result.text).toBe('Hello from audio');
    expect(whisper.transcribe).toHaveBeenCalled();
  });

  it('returns service unavailable when OpenAI key missing', async () => {
    config.get.mockReturnValueOnce('');
    const webmHead = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    const buffer = Buffer.concat([webmHead, Buffer.alloc(2048, 0)]);
    const req = {
      isMultipart: () => true,
      parts: async function* () {
        yield {
          type: 'file',
          fieldname: 'file',
          filename: 'clip.webm',
          mimetype: 'audio/webm',
          toBuffer: async () => buffer,
        };
      },
    } as never;

    await expect(service().transcribeDescribeAgent(req)).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
