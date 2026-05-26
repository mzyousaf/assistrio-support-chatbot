import {
  buildCustomerProfilePatchPayload,
  customerProfileFormFromSession,
  validateCustomerProfileForm,
} from '@/lib/customerProfileForm';
import { describe, expect, it } from 'vitest';

describe('validateCustomerProfileForm', () => {
  it('accepts empty optional URLs', () => {
    expect(
      validateCustomerProfileForm({
        name: 'Jane Doe',
        linkedinUrl: '',
        calendlyUrl: '',
        websiteUrl: '',
        otherUrl: '',
      }),
    ).toEqual({});
  });

  it('rejects invalid URLs', () => {
    const errors = validateCustomerProfileForm({
      name: 'Jane Doe',
      linkedinUrl: ':::not-a-url',
      calendlyUrl: '',
      websiteUrl: '',
      otherUrl: '',
    });
    expect(errors.linkedinUrl).toMatch(/valid/);
  });

  it('validates websiteUrl and otherUrl independently', () => {
    const errors = validateCustomerProfileForm({
      name: 'Jane Doe',
      linkedinUrl: '',
      calendlyUrl: '',
      websiteUrl: 'https://example.com',
      otherUrl: ':::not-a-url',
    });
    expect(errors.websiteUrl).toBeUndefined();
    expect(errors.otherUrl).toMatch(/valid/);
  });
});

describe('customerProfileFormFromSession', () => {
  it('maps websiteUrl and otherUrl from profileLinks', () => {
    expect(
      customerProfileFormFromSession({
        id: 'u1',
        email: 'jane@example.com',
        role: 'customer',
        workspaceIds: [],
        firstName: 'Jane',
        lastName: 'Doe',
        profileLinks: {
          linkedinUrl: null,
          calendlyUrl: null,
          websiteUrl: 'https://example.com',
          otherUrl: 'https://other.example.com',
        },
      }),
    ).toMatchObject({
      websiteUrl: 'https://example.com',
      otherUrl: 'https://other.example.com',
    });
  });
});

describe('buildCustomerProfilePatchPayload', () => {
  it('includes websiteUrl and otherUrl changes in profileLinks', () => {
    const baseline = {
      name: 'Jane Doe',
      linkedinUrl: '',
      calendlyUrl: '',
      websiteUrl: '',
      otherUrl: '',
    };
    expect(
      buildCustomerProfilePatchPayload(
        {
          ...baseline,
          websiteUrl: 'example.com',
          otherUrl: 'https://other.example.com',
        },
        baseline,
      ),
    ).toEqual({
      profileLinks: {
        websiteUrl: 'https://example.com/',
        otherUrl: 'https://other.example.com/',
      },
    });
  });
});
