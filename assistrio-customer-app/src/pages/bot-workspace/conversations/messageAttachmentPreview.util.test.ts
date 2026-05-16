import { describe, expect, it } from 'vitest';
import type { CustomerConversationMessageAttachment } from '@/api/types';
import {
  normalizeCustomerMessageAttachment,
  pickSafeHttpUrlFromAttachmentFields,
} from './messageAttachmentPreview.util';

type Raw = CustomerConversationMessageAttachment & Record<string, unknown>;

describe('pickSafeHttpUrlFromAttachmentFields', () => {
  it('skips s3 and uses https downloadUrl', () => {
    expect(
      pickSafeHttpUrlFromAttachmentFields({
        name: 'a',
        url: 's3://b/k',
        downloadUrl: 'https://example.com/signed',
      } as Raw),
    ).toBe('https://example.com/signed');
  });

  it('returns empty when only unsafe urls', () => {
    expect(
      pickSafeHttpUrlFromAttachmentFields({
        name: 'a',
        url: 's3://b/k',
        downloadUrl: 'file:///etc/passwd',
      } as Raw),
    ).toBe('');
  });

  it('accepts first safe http(s) in order url, downloadUrl, publicUrl, href', () => {
    expect(
      pickSafeHttpUrlFromAttachmentFields({
        name: 'a',
        url: 'https://first.example/x',
        downloadUrl: 'https://second.example/y',
      } as Raw),
    ).toBe('https://first.example/x');
  });
});

describe('normalizeCustomerMessageAttachment', () => {
  it('uses filename and sizeBytes when primary fields absent', () => {
    const n = normalizeCustomerMessageAttachment({
      filename: 'notes.txt',
      contentType: 'text/plain',
      sizeBytes: 512,
    } as Raw);
    expect(n.name).toBe('notes.txt');
    expect(n.mimeType).toBe('text/plain');
    expect(n.size).toBe(512);
  });

  it('leaves safeUrl empty for internal-only urls', () => {
    const n = normalizeCustomerMessageAttachment({
      name: 'x',
      mimeType: 'application/pdf',
      size: 100,
      url: 's3://bucket/key',
    } as Raw);
    expect(n.safeUrl).toBe('');
  });
});
