/**
 * Full ISO 639-1 language list for the Response language control, plus regional
 * variants where a single macro-language code would be ambiguous.
 */
import ISO6391 from 'iso-639-1';

/** Replaces these ISO 639-1 macro codes with clearer BCP-47-style options. */
const SKIP_ISO_CODES = new Set(['en', 'pt', 'zh']);

const REGIONAL_LANGUAGES: { value: string; label: string }[] = [
  { value: 'en-US', label: 'English' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'pt-PT', label: 'Portuguese (Portugal)' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
];

function buildFixedLanguageRows(): { value: string; label: string }[] {
  const codes = ISO6391.getAllCodes() as string[];
  const fromIso = codes
    .filter((code) => !SKIP_ISO_CODES.has(code))
    .map((code) => {
      const label = ISO6391.getName(code);
      return { value: code, label: label || code };
    });
  const merged = [...REGIONAL_LANGUAGES, ...fromIso];
  merged.sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
  return merged;
}

const FIXED_LANGUAGE_ROWS = buildFixedLanguageRows();

/** Every ISO 639-1 option (sorted by label), after Auto. */
export const RESPONSE_LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto (match visitor language)' },
  ...FIXED_LANGUAGE_ROWS,
];
