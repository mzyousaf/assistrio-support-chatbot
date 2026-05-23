import { BadRequestException } from '@nestjs/common';
import {
  assertOnboardingAllowedOriginsLimit,
  dedupeOnboardingAllowedOrigins,
  ONBOARDING_ALLOWED_ORIGINS_LIMIT_ERROR_CODE,
  ONBOARDING_ALLOWED_ORIGINS_LIMIT_MESSAGE,
} from './workspace-onboarding-allowed-origins.util';

describe('onboarding allowed origins limit', () => {
  it('deduplicates normalized origins', () => {
    const deduped = dedupeOnboardingAllowedOrigins([
      { origin: 'https://Example.com', isActive: true },
      { origin: 'https://example.com', isActive: true },
      { origin: 'https://shop.example.com', isActive: true },
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((row) => row.origin)).toEqual([
      'https://Example.com',
      'https://shop.example.com',
    ]);
  });

  it('rejects more than 3 origins on PATCH', () => {
    expect(() =>
      assertOnboardingAllowedOriginsLimit([
        { origin: 'https://a.example.com', isActive: true },
        { origin: 'https://b.example.com', isActive: true },
        { origin: 'https://c.example.com', isActive: true },
        { origin: 'https://d.example.com', isActive: true },
      ]),
    ).toThrow(BadRequestException);

    try {
      assertOnboardingAllowedOriginsLimit([
        { origin: 'https://a.example.com', isActive: true },
        { origin: 'https://b.example.com', isActive: true },
        { origin: 'https://c.example.com', isActive: true },
        { origin: 'https://d.example.com', isActive: true },
      ]);
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        errorCode?: string;
        error?: string;
      };
      expect(response.errorCode).toBe(ONBOARDING_ALLOWED_ORIGINS_LIMIT_ERROR_CODE);
      expect(response.error).toBe(ONBOARDING_ALLOWED_ORIGINS_LIMIT_MESSAGE);
    }
  });

  it('allows exactly 3 unique origins', () => {
    expect(() =>
      assertOnboardingAllowedOriginsLimit([
        { origin: 'https://a.example.com', isActive: true },
        { origin: 'https://b.example.com', isActive: true },
        { origin: 'https://c.example.com', isActive: true },
      ]),
    ).not.toThrow();
  });
});
