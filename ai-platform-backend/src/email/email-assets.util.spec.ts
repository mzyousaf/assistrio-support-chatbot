import { resolveAssistrioEmailLogoAssets } from './email-assets.util';

const logoPath1 = 'https://drive.google.com/uc?export=view&id=1ztM1pusYZ_PpCNZdnFzh-_NpuV17wRrX';
const logoPath2 = 'https://drive.google.com/uc?export=view&id=1Z-ys-VYR42SDwjJpdOgBlTcGgy-uABFJ';

describe('resolveAssistrioEmailLogoAssets', () => {
  it('returns mark and text URLs from EMAIL_LOGO_PATH_1 and EMAIL_LOGO_PATH_2', () => {
    expect(
      resolveAssistrioEmailLogoAssets({
        logoPath1,
        logoPath2,
      }),
    ).toEqual({
      markUrl: logoPath1,
      textUrl: logoPath2,
    });
  });

  it('returns null URLs when env values are missing or invalid', () => {
    expect(resolveAssistrioEmailLogoAssets({})).toEqual({
      markUrl: null,
      textUrl: null,
    });

    expect(
      resolveAssistrioEmailLogoAssets({
        logoPath1: 'not-a-url',
        logoPath2: logoPath2,
      }),
    ).toEqual({
      markUrl: null,
      textUrl: logoPath2,
    });
  });
});
