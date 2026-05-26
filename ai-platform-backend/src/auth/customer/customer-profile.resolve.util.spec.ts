import { resolveCustomerSessionProfile, splitDisplayName } from './customer-profile.resolve.util';

describe('customer-profile.resolve.util', () => {
  it('splitDisplayName splits on first space', () => {
    expect(splitDisplayName('Jane Doe')).toEqual({ firstName: 'Jane', lastName: 'Doe' });
    expect(splitDisplayName('Prince')).toEqual({ firstName: 'Prince', lastName: '' });
  });

  it('prefers displayNameOverride over Google first/last name', () => {
    expect(
      resolveCustomerSessionProfile({
        firstName: 'Google',
        lastName: 'Name',
        picture: 'https://google.example/photo.jpg',
        displayNameOverride: 'Custom Name',
      }),
    ).toEqual({
      firstName: 'Custom',
      lastName: 'Name',
      picture: 'https://google.example/photo.jpg',
    });
  });

  it('prefers pictureOverride over Google picture', () => {
    expect(
      resolveCustomerSessionProfile({
        firstName: 'Ada',
        lastName: 'Lovelace',
        picture: 'https://google.example/photo.jpg',
        pictureOverride: 'https://cdn.example/custom.png',
      }),
    ).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      picture: 'https://cdn.example/custom.png',
    });
  });

  it('pictureOverride null falls back to Google picture', () => {
    expect(
      resolveCustomerSessionProfile({
        firstName: 'Ada',
        picture: 'https://google.example/photo.jpg',
        pictureOverride: null,
      }),
    ).toEqual({
      firstName: 'Ada',
      lastName: undefined,
      picture: 'https://google.example/photo.jpg',
    });
  });
});
