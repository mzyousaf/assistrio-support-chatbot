import { describe, expect, it } from 'vitest';
import { scoreToAverageSentimentFace } from './AverageSentimentFaceMeter';

describe('scoreToAverageSentimentFace', () => {
  it('maps 0.5–1 to super happy', () => {
    expect(scoreToAverageSentimentFace(1)).toBe('superHappy');
    expect(scoreToAverageSentimentFace(0.5)).toBe('superHappy');
  });

  it('maps 0.1–0.49 to happy', () => {
    expect(scoreToAverageSentimentFace(0.42)).toBe('happy');
    expect(scoreToAverageSentimentFace(0.1)).toBe('happy');
    expect(scoreToAverageSentimentFace(0.49)).toBe('happy');
  });

  it('maps −0.09–0.09 to neutral', () => {
    expect(scoreToAverageSentimentFace(0)).toBe('neutral');
    expect(scoreToAverageSentimentFace(0.09)).toBe('neutral');
    expect(scoreToAverageSentimentFace(-0.09)).toBe('neutral');
  });

  it('maps −0.49–−0.1 to unhappy', () => {
    expect(scoreToAverageSentimentFace(-0.3)).toBe('unhappy');
    expect(scoreToAverageSentimentFace(-0.1)).toBe('unhappy');
    expect(scoreToAverageSentimentFace(-0.49)).toBe('unhappy');
  });

  it('maps −1–−0.5 to super angry', () => {
    expect(scoreToAverageSentimentFace(-0.5)).toBe('superAngry');
    expect(scoreToAverageSentimentFace(-1)).toBe('superAngry');
  });

  it('clamps out-of-range scores', () => {
    expect(scoreToAverageSentimentFace(2)).toBe('superHappy');
    expect(scoreToAverageSentimentFace(-2)).toBe('superAngry');
  });
});
