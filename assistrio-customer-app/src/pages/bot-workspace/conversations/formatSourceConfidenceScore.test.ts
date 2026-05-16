import { describe, expect, it } from 'vitest';
import {
  SOURCE_SCORE_MISSING_TOOLTIP,
  SOURCE_SCORE_UNAVAILABLE_LABEL,
  SOURCE_SCORE_VISIBLE_LABEL,
  formatConfidencePercentLabel,
  formatSourceConfidenceScore,
  formatSourceMatchNumericDisplay,
  retrievalScoreToConfidencePercent,
  sourceScoreTooltipWithValue,
} from './formatSourceConfidenceScore';

describe('formatSourceMatchNumericDisplay', () => {
  it('formats examples per spec', () => {
    expect(formatSourceMatchNumericDisplay(0.82)).toBe('0.82');
    expect(formatSourceMatchNumericDisplay(0.465123)).toBe('0.465');
    expect(formatSourceMatchNumericDisplay(1.23456)).toBe('1.235');
    expect(formatSourceMatchNumericDisplay(0)).toBe('0');
  });
});

describe('formatSourceConfidenceScore', () => {
  it('shows numeric score, not percent', () => {
    expect(formatSourceConfidenceScore(0.82)?.matchLabel).toBe('0.82');
    expect(formatSourceConfidenceScore(0.82)?.matchLabel).not.toMatch(/%/);
    expect(formatSourceConfidenceScore(0.465123)?.matchLabel).toBe('0.465');
    expect(formatSourceConfidenceScore(1.23456)?.matchLabel).toBe('1.235');
    expect(formatSourceConfidenceScore(0)?.matchLabel).toBe('0');
    expect(formatSourceConfidenceScore(1)?.matchLabel).toBe('1');
  });

  it('formats larger values with 3dp trim', () => {
    expect(formatSourceConfidenceScore(12.345)?.matchLabel).toBe('12.345');
    expect(formatSourceConfidenceScore(2)?.matchLabel).toBe('2');
  });

  it('returns null for missing or non-finite (do not fake scores)', () => {
    expect(formatSourceConfidenceScore(undefined)).toBeNull();
    expect(formatSourceConfidenceScore(null)).toBeNull();
    expect(formatSourceConfidenceScore(Number.NaN)).toBeNull();
    expect(formatSourceConfidenceScore(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('tooltip shows numeric score then rounded % of cited content', () => {
    const f = formatSourceConfidenceScore(0.5);
    expect(f?.confidenceTitle.toLowerCase()).toContain('confidence score is');
    expect(f?.confidenceTitle).toContain('0.5');
    expect(f?.confidenceTitle).toMatch(/50%/);
    expect(f?.confidenceTitle.toLowerCase()).toContain('of the cited content');
    const g = formatSourceConfidenceScore(0.443);
    expect(g?.confidenceTitle).toContain('0.443');
    expect(g?.confidenceTitle).toMatch(/44%/);
  });
});

describe('sourceScoreTooltipWithValue', () => {
  it('includes numeric score and rounded percent of cited content', () => {
    expect(sourceScoreTooltipWithValue(0.82).toLowerCase()).toContain('confidence score is');
    expect(sourceScoreTooltipWithValue(0.82)).toContain('0.82');
    expect(sourceScoreTooltipWithValue(0.82)).toMatch(/82%/);
    expect(sourceScoreTooltipWithValue(0.05)).toContain('0.05');
    expect(sourceScoreTooltipWithValue(0.05)).toMatch(/5%/);
  });
});

describe('retrievalScoreToConfidencePercent', () => {
  it('maps typical 0–1 retrieval scores to rounded percent', () => {
    expect(retrievalScoreToConfidencePercent(0)).toBe(0);
    expect(retrievalScoreToConfidencePercent(0.82)).toBe(82);
    expect(retrievalScoreToConfidencePercent(1)).toBe(100);
    expect(retrievalScoreToConfidencePercent(0.095)).toBe(10);
    expect(retrievalScoreToConfidencePercent(0.094)).toBe(9);
  });

  it('treats values above 1 as already-on-percent scale (clamped)', () => {
    expect(retrievalScoreToConfidencePercent(50)).toBe(50);
    expect(retrievalScoreToConfidencePercent(150)).toBe(100);
  });
});

describe('formatConfidencePercentLabel', () => {
  it('renders percent suffix', () => {
    expect(formatConfidencePercentLabel(0.82)).toBe('82%');
  });
});

describe('UI copy exports', () => {
  it('exposes label and unavailable text for Conversations', () => {
    expect(SOURCE_SCORE_VISIBLE_LABEL).toBe('Confidence Score');
    expect(SOURCE_SCORE_UNAVAILABLE_LABEL).toBe('Score not available');
    expect(SOURCE_SCORE_MISSING_TOOLTIP.toLowerCase()).toContain('confidence score');
    expect(SOURCE_SCORE_MISSING_TOOLTIP.toLowerCase()).toContain('not available');
  });
});
