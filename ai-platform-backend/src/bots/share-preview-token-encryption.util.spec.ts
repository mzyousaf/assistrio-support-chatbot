import {
  decryptSharePreviewTokenFromStorage,
  encryptSharePreviewTokenForStorage,
  getSharePreviewTokenEncryptionKey,
  resetSharePreviewEncryptionKeyCacheForTests,
} from './share-preview-token-encryption.util';

describe('share-preview-token-encryption.util', () => {
  const prevSecret = process.env.SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET = 't'.repeat(40);
    resetSharePreviewEncryptionKeyCacheForTests();
  });

  afterAll(() => {
    if (prevSecret === undefined) delete process.env.SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET;
    else process.env.SHARE_PREVIEW_TOKEN_ENCRYPTION_SECRET = prevSecret;
    process.env.NODE_ENV = prevNodeEnv;
    resetSharePreviewEncryptionKeyCacheForTests();
  });

  it('round-trips a preview token', () => {
    const key = getSharePreviewTokenEncryptionKey();
    const plain = 'url-safe-token-example_abc123';
    const enc = encryptSharePreviewTokenForStorage(plain, key);
    expect(enc).not.toContain(plain);
    expect(decryptSharePreviewTokenFromStorage(enc, key)).toBe(plain);
  });

  it('returns null for tampered ciphertext', () => {
    const key = getSharePreviewTokenEncryptionKey();
    const enc = encryptSharePreviewTokenForStorage('hello', key);
    const buf = Buffer.from(enc, 'base64url');
    if (buf.length > 4) buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64url');
    expect(decryptSharePreviewTokenFromStorage(tampered, key)).toBeNull();
  });
});
