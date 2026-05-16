import { generateSharePreviewPlainToken, hashSharePreviewToken, verifySharePreviewToken } from './share-preview-token.util';

describe('share-preview-token.util', () => {
  it('verifySharePreviewToken accepts matching token', () => {
    const plain = generateSharePreviewPlainToken();
    const hash = hashSharePreviewToken(plain);
    expect(verifySharePreviewToken(hash, plain)).toBe(true);
  });

  it('verifySharePreviewToken rejects wrong token', () => {
    const plain = generateSharePreviewPlainToken();
    const hash = hashSharePreviewToken(plain);
    expect(verifySharePreviewToken(hash, `${plain}x`)).toBe(false);
  });

  it('verifySharePreviewToken rejects missing hash or token', () => {
    expect(verifySharePreviewToken(undefined, 'x')).toBe(false);
    expect(verifySharePreviewToken('abcd', 'x')).toBe(false);
    expect(verifySharePreviewToken(hashSharePreviewToken('a'), undefined)).toBe(false);
    expect(verifySharePreviewToken(hashSharePreviewToken('a'), '')).toBe(false);
  });
});
