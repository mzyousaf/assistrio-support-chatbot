/** Minimal Web Speech API surface used for dictation (DOM lib may omit types in `.d.ts` builds). */

export type AssistrioSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

export type AssistrioSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: AssistrioSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

export type AssistrioSpeechRecognitionCtor = new () => AssistrioSpeechRecognition;

/** Web Speech API constructor when available (Chromium / Safari). */
export function getSpeechRecognitionCtor(): AssistrioSpeechRecognitionCtor | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as typeof globalThis & {
    SpeechRecognition?: AssistrioSpeechRecognitionCtor;
    webkitSpeechRecognition?: AssistrioSpeechRecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}
