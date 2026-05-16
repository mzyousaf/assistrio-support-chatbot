import { MessageSchema } from './message.schema';

describe('Message schema inputMethod enum', () => {
  it('allows microphone_transcription (Whisper dictation) for persistence', () => {
    const st = MessageSchema.path('inputMethod') as { enumValues?: readonly string[] };
    expect(st.enumValues).toContain('microphone_transcription');
    expect(st.enumValues).toContain('microphone');
    expect(st.enumValues).toContain('keyboard');
  });
});
