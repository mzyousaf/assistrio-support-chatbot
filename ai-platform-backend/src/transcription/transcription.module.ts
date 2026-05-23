import { Module } from '@nestjs/common';
import { WhisperTranscriptionService } from './whisper-transcription.service';

/**
 * Shared OpenAI Whisper transcription — no chat/workspace/auth dependencies.
 * Import this module wherever speech-to-text is needed without pulling in ChatModule.
 */
@Module({
  providers: [WhisperTranscriptionService],
  exports: [WhisperTranscriptionService],
})
export class TranscriptionModule {}
