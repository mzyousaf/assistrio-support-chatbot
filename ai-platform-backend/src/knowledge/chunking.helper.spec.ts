/**
 * Unit tests for section-aware chunking: headings, FAQs, lists, policy/contact blocks, HTML-derived text.
 */

import {
  chunkDocumentText,
  chunkDocumentTextWithMetadata,
  inferChunkKind,
  type ChunkWithMetadata,
} from './chunking.helper';

describe('chunkDocumentText', () => {
  it('preserves markdown headings and attaches section to chunks', () => {
    const text = `# Overview
This is the overview section with some introductory content.

## Features
First feature is X. Second feature is Y.

## Contact
Email: support@example.com. Phone: 1-800-123-4567.`;
    const chunks = chunkDocumentText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.includes('[Overview]'))).toBe(true);
    expect(chunks.some((c) => c.includes('[Features]') || c.includes('First feature'))).toBe(true);
    expect(chunks.some((c) => c.includes('[Contact]') || c.includes('support@example.com'))).toBe(true);
  });

  it('preserves numbered sections', () => {
    const text = `1. Introduction
We provide services.

2. Refund Policy
Refunds within 30 days.

3. Contact Us
Call 555-0100.`;
    const chunks = chunkDocumentText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((c) => c.includes('Refund') || c.includes('30 days'))).toBe(true);
  });

  it('does not split FAQ question-answer pairs', () => {
    const text = `# Support

Q: What are your hours?
A: We are open 9am to 5pm Monday to Friday.

Q: How do I get a refund?
A: Request a refund within 30 days from your account.`;
    const chunks = chunkDocumentText(text);
    const faqChunks = chunks.filter((c) => inferChunkKind(c) === 'faq');
    expect(faqChunks.length).toBeGreaterThanOrEqual(2);
    faqChunks.forEach((chunk) => {
      expect(chunk).toMatch(/Q:.*\nA:/s);
      expect(chunk).not.toMatch(/Q:.*\n[^AQ].*Q:/s);
    });
  });

  it('preserves bullet and numbered list structure without splitting list lines', () => {
    const text = `# Pricing

- Basic: $10/month
- Pro: $25/month
- Enterprise: custom`;
    const chunks = chunkDocumentText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const allText = chunks.join('\n');
    expect(allText).toMatch(/\$10\/month/);
    expect(allText).toMatch(/\$25\/month/);
    chunks.forEach((c) => {
      if (c.includes('- Basic')) {
        expect(c).toMatch(/- Basic:\s*\$/);
        expect(c).toMatch(/- Pro:\s*\$/);
      }
    });
  });

  it('preserves short contact info and disclaimers as meaningful units', () => {
    const text = `# Main content
Some body here.

# Contact
support@example.com
1-800-555-0100

# Disclaimer
No warranty. Use at your own risk.`;
    const chunks = chunkDocumentText(text);
    expect(chunks.some((c) => c.includes('support@example.com') || c.includes('Contact'))).toBe(true);
    expect(chunks.some((c) => c.includes('Disclaimer') || c.includes('No warranty'))).toBe(true);
  });

  it('preserves refund/policy text without splitting mid-sentence', () => {
    const text = `# Refund Policy
You may request a full refund within 30 days of purchase. Refunds are processed within 5-7 business days. Contact support for exceptions.`;
    const chunks = chunkDocumentText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((c) => c.includes('30 days') && c.includes('refund'))).toBe(true);
  });

  it('chunks HTML-derived structured text the same way (headings and sections)', () => {
    const htmlDerived = `
Overview
We offer services.

Office Hours
Monday–Friday 9am–5pm. Closed holidays.

Contact
Email: help@example.com`;
    const chunks = chunkDocumentText(htmlDerived);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((c) => c.includes('Office Hours') || c.includes('9am'))).toBe(true);
  });

  it('keeps very short trailing sections as meaningful units', () => {
    const text = `# Intro
A short intro sentence.

# Disclaimer
© 2024 Company. All rights reserved.`;
    const chunks = chunkDocumentText(text);
    expect(chunks.some((c) => c.includes('©') || c.includes('Company') || c.includes('Disclaimer'))).toBe(true);
  });

  it('splits long paragraphs at natural boundaries', () => {
    const longParagraph = 'Sentence one. Sentence two. Sentence three. '.repeat(40);
    const text = `# Section\n\n${longParagraph}`;
    const chunks = chunkDocumentText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((c) => {
      expect(c.length).toBeLessThanOrEqual(750);
      expect(c.trim().length).toBeGreaterThanOrEqual(50);
    });
  });

  it('returns empty array for empty or whitespace-only input', () => {
    expect(chunkDocumentText('')).toEqual([]);
    expect(chunkDocumentText('   \n\n  ')).toEqual([]);
  });

  it('fallback chunks plain text without headings', () => {
    const plain = 'Just a long paragraph. '.repeat(60);
    const chunks = chunkDocumentText(plain);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });
});

describe('inferChunkKind', () => {
  it('returns "faq" for [Section]\nQ: ...\nA: ... format', () => {
    expect(inferChunkKind('[Support]\nQ: Hours?\nA: 9-5.')).toBe('faq');
  });

  it('returns "section" for [Section]\n plain content', () => {
    expect(inferChunkKind('[Overview]\nWe provide services.')).toBe('section');
  });

  it('returns "section" for text without bracket', () => {
    expect(inferChunkKind('Plain text.')).toBe('section');
  });
});

describe('chunkDocumentTextWithMetadata', () => {
  it('returns chunks with metadata (chunkIndex, totalChunks, sectionTitle)', () => {
    const text = `# Intro
This is the introduction section with enough content to form a valid chunk for retrieval.

# Details
Here are the details section with sufficient length to be chunked.`;
    const result = chunkDocumentTextWithMetadata(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((item: ChunkWithMetadata, i: number) => {
      expect(item.text).toBeDefined();
      expect(typeof item.text).toBe('string');
      expect(item.metadata).toBeDefined();
      expect(item.metadata!.chunkIndex).toBe(i);
      expect(item.metadata!.totalChunks).toBe(result.length);
      if (item.text.startsWith('[')) {
        expect(item.metadata!.sectionTitle).toBeDefined();
      }
    });
  });

  it('accepts sourceTitle and sourceType for HTML/document context', () => {
    const text = `# One
Enough content here to exceed minimum chunk length so we get at least one chunk with metadata.`;
    const result = chunkDocumentTextWithMetadata(text, {
      sourceTitle: 'FAQ Page',
      sourceType: 'html',
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].metadata!.sourceTitle).toBe('FAQ Page');
    expect(result[0].metadata!.sourceType).toBe('html');
  });

  it('produces same text array as chunkDocumentText', () => {
    const text = `# A\nContent one.\n\n# B\nContent two.`;
    const strings = chunkDocumentText(text);
    const withMeta = chunkDocumentTextWithMetadata(text);
    expect(withMeta.map((c) => c.text)).toEqual(strings);
  });
});
