import { describe, expect, it } from 'vitest';



import {

  buildAiIntegrationsPreviewDraftSlice,

  buildResponseStylePreviewClearFields,

  clampCreativity,

  CREATIVITY_MAX,

  CREATIVITY_MIN,

  CREATIVITY_STEP,

  creativityModeLabel,

  isCreativityRecommendedValue,

  normalizeResponseStyleInstructions,

  resolveStructuredResponseFormatEnabledFromConfig,

  isResponseLengthRecommendedValue,

  LENGTH_PRIMARY_MARKER_LABELS,

  LENGTH_PRIMARY_MARKER_TOKENS,

  maxTokensToResponseLength,

  maxTokensToPresetIndex,

  MAX_TOKENS_MAX,

  MAX_TOKENS_MIN,

  presetIndexToMaxTokens,

  primaryPresetGroupIndex,

  responseLengthModeLabel,

  responseLengthToMaxTokens,

  RESPONSE_LENGTH_ALL_PRESET_TOKENS,

  RESPONSE_LENGTH_PRESET_LABELS,

  RESPONSE_LENGTH_PRESET_TOKENS,

  RESPONSE_LENGTH_RECOMMENDED_TOKENS,

  snapMaxTokens,

} from './aiIntegrationsConstants';



import {

  buildCustomerWidgetPreviewOverridesFromBot,

  mergeAiIntegrationsDraftIntoPreviewOverrides,

} from '@/lib/buildCustomerWidgetPreviewOverrides';



import type { CustomerBotDetail } from '@/api/types';



describe('creativity slider', () => {

  it('uses 0 min, 1 max, and 0.05 step', () => {

    expect(CREATIVITY_MIN).toBe(0);

    expect(CREATIVITY_MAX).toBe(1);

    expect(CREATIVITY_STEP).toBe(0.05);

  });



  it('labels 0 as Maximum focus and 1 as Maximum creativity', () => {

    expect(creativityModeLabel(0)).toBe('Maximum focus');

    expect(creativityModeLabel(1)).toBe('Maximum creativity');

  });

});



describe('response length nine presets', () => {

  it('exposes nine snap points', () => {

    expect(RESPONSE_LENGTH_ALL_PRESET_TOKENS).toEqual([64, 80, 96, 128, 160, 208, 256, 384, 512]);

    expect(RESPONSE_LENGTH_PRESET_LABELS).toEqual([

      'Tiny',

      'Tiny+',

      'Short',

      'Short+',

      'Standard',

      'Standard+',

      'Detailed',

      'Detailed+',

      'Complete',

    ]);

    expect(LENGTH_PRIMARY_MARKER_LABELS).toEqual(['Tiny', 'Short', 'Standard', 'Detailed', 'Complete']);

    expect(LENGTH_PRIMARY_MARKER_TOKENS).toEqual([64, 96, 160, 256, 512]);

  });



  it('never leaves intermediate values like 288', () => {

    expect(snapMaxTokens(288)).toBe(256);

    expect(RESPONSE_LENGTH_ALL_PRESET_TOKENS).toContain(snapMaxTokens(288));

  });



  it('labels plus presets correctly', () => {

    expect(responseLengthModeLabel(80)).toBe('Tiny+');

    expect(responseLengthModeLabel(128)).toBe('Short+');

    expect(responseLengthModeLabel(208)).toBe('Standard+');

    expect(responseLengthModeLabel(384)).toBe('Detailed+');

  });



  it('maps presets to responseLength enum', () => {

    expect(maxTokensToResponseLength(80)).toBe('short');

    expect(maxTokensToResponseLength(128)).toBe('medium');

    expect(maxTokensToResponseLength(208)).toBe('long');

    expect(maxTokensToResponseLength(160)).toBe('medium');

    expect(maxTokensToResponseLength(384)).toBe('long');

  });



  it('only treats Short (96 tokens) as recommended', () => {

    expect(isResponseLengthRecommendedValue(96)).toBe(true);

    expect(isResponseLengthRecommendedValue(160)).toBe(false);

    expect(RESPONSE_LENGTH_RECOMMENDED_TOKENS).toBe(96);

  });



  it('maps preset index to exact tokens', () => {

    expect(presetIndexToMaxTokens(1)).toBe(80);

    expect(maxTokensToPresetIndex(384)).toBe(7);

  });



  it('groups primary markers for plus presets', () => {

    expect(primaryPresetGroupIndex(80)).toBe(0);

    expect(primaryPresetGroupIndex(128)).toBe(1);

    expect(primaryPresetGroupIndex(208)).toBe(2);

    expect(primaryPresetGroupIndex(384)).toBe(3);

  });

});



describe('response length bounds', () => {

  it('uses 64 min and 512 max', () => {

    expect(MAX_TOKENS_MIN).toBe(64);

    expect(MAX_TOKENS_MAX).toBe(512);

    expect(snapMaxTokens(50)).toBe(64);

    expect(snapMaxTokens(600)).toBe(512);

  });

});



describe('responseLengthToMaxTokens', () => {

  it('maps onboarding enum values to preset caps', () => {

    expect(responseLengthToMaxTokens('short')).toBe(96);

    expect(responseLengthToMaxTokens('medium')).toBe(160);

    expect(responseLengthToMaxTokens('long')).toBe(512);

  });

});



describe('buildAiIntegrationsPreviewDraftSlice', () => {

  it('preview draft snaps non-preset maxTokens before save', () => {

    const slice = buildAiIntegrationsPreviewDraftSlice({

      creativity: 0.5,

      maxTokens: 288,

      answerMode: 'knowledge_first',

      structuredResponseFormatEnabled: false,

      responseStyleDescription: '',

      responseStyleInstructions: '',

      allowFileUpload: false,

      showMic: false,

      showVoice: false,

    });

    expect(slice.config.maxTokens).toBe(256);

    expect(slice.config.responseLength).toBe('long');

    expect(slice.config.maxTokens).not.toBe(288);

  });



  it('save payload uses only preset maxTokens for Standard', () => {

    const slice = buildAiIntegrationsPreviewDraftSlice({

      creativity: 0.3,

      maxTokens: 160,

      answerMode: 'knowledge_first',

      structuredResponseFormatEnabled: false,

      responseStyleDescription: '',

      responseStyleInstructions: '',

      allowFileUpload: false,

      showMic: false,

      showVoice: false,

    });

    expect(slice.config).toEqual({

      temperature: 0.3,

      maxTokens: 160,

      responseLength: 'medium',

      answerMode: 'knowledge_first',

      ...buildResponseStylePreviewClearFields(),

    });

  });

});



const mockBot = {

  name: 'Test',

  config: {

    temperature: 0.5,

    maxTokens: 160,

    responseLength: 'medium',

    responseStyleMode: 'structured',

    responseStyleInstructions: 'Saved style',

  },

} as CustomerBotDetail;



describe('previewOverrides merge', () => {

  it('Case Tiny: draft overrides baseline', () => {

    const baseline = buildCustomerWidgetPreviewOverridesFromBot(mockBot);

    const draft = buildAiIntegrationsPreviewDraftSlice({

      creativity: 0.5,

      maxTokens: 64,

      answerMode: 'knowledge_first',

      structuredResponseFormatEnabled: false,

      responseStyleDescription: '',

      responseStyleInstructions: '',

      allowFileUpload: false,

      showMic: false,

      showVoice: false,

    });

    const merged = mergeAiIntegrationsDraftIntoPreviewOverrides(baseline, draft);

    expect(merged.config?.maxTokens).toBe(64);

    expect(merged.config?.responseLength).toBe('short');

  });

});


