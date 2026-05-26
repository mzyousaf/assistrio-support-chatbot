import {
  buildEmailAvatarPairHtml,
  deriveEmailAvatarInitials,
  isUsableEmailAvatarUrl,
  resolveSupportUrl,
} from './email-avatar.util';

describe('email-avatar.util', () => {
  it('derives initials from name and email', () => {
    expect(deriveEmailAvatarInitials('Alex Admin', null)).toBe('AA');
    expect(deriveEmailAvatarInitials(null, 'guest@example.com')).toBe('GU');
  });

  it('rejects Google Drive and localhost avatar URLs', () => {
    expect(
      isUsableEmailAvatarUrl(
        'https://drive.google.com/uc?export=view&id=abc',
        'production',
      ),
    ).toBe(false);
    expect(isUsableEmailAvatarUrl('http://localhost:3002/avatar.png', 'production')).toBe(false);
    expect(isUsableEmailAvatarUrl('https://lh3.googleusercontent.com/a/photo', 'production')).toBe(
      true,
    );
  });

  it('builds avatar pair HTML with plus connector', () => {
    const html = buildEmailAvatarPairHtml(
      { email: 'guest@example.com' },
      { name: 'Alex Admin' },
      'production',
    );
    expect(html).toContain('+');
    expect(html).toContain('GU');
    expect(html).toContain('AA');
  });
});

describe('resolveSupportUrl', () => {
  it('returns valid support URLs only', () => {
    expect(resolveSupportUrl('https://assistrio.com/contact')).toBe('https://assistrio.com/contact');
    expect(resolveSupportUrl('')).toBeNull();
    expect(resolveSupportUrl('not-a-url')).toBeNull();
  });
});
