import { BadRequestException } from '@nestjs/common';
import { parsePatchCustomerProfileBody } from './customer-profile.validation';

describe('parsePatchCustomerProfileBody', () => {
  it('parses name into displayNameOverride', () => {
    expect(parsePatchCustomerProfileBody({ name: 'Jane Doe' })).toEqual({
      displayNameOverride: 'Jane Doe',
    });
  });

  it('normalizes profile link URLs and allows null clears', () => {
    expect(
      parsePatchCustomerProfileBody({
        profileLinks: {
          linkedinUrl: 'linkedin.com/in/jane',
          calendlyUrl: null,
          websiteUrl: 'https://example.com',
          otherUrl: 'https://other.example.com/path',
        },
      }),
    ).toEqual({
      profileLinks: {
        linkedinUrl: 'https://linkedin.com/in/jane',
        calendlyUrl: null,
        websiteUrl: 'https://example.com/',
        otherUrl: 'https://other.example.com/path',
      },
    });
  });

  it('validates otherUrl like other profile links', () => {
    expect(() =>
      parsePatchCustomerProfileBody({
        profileLinks: { otherUrl: 'not a url' },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid URLs', () => {
    expect(() =>
      parsePatchCustomerProfileBody({
        profileLinks: { websiteUrl: 'not a url' },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects email changes', () => {
    expect(() => parsePatchCustomerProfileBody({ email: 'other@example.com', name: 'Jane' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects empty patch bodies', () => {
    expect(() => parsePatchCustomerProfileBody({})).toThrow(BadRequestException);
  });
});
