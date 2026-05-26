import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_DOC_UPLOAD_FILESIZE_VS_QUOTA_MESSAGE,
  MAX_KB_UPLOAD_FILE_SIZE_LABEL,
} from '@/lib/knowledgeStorageLimits';
import { CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE } from '@/lib/botFieldLimits';

describe('knowledgeStorageLimits copy', () => {
  it('keeps upload file size separate from trained knowledge quota messaging', () => {
    expect(KNOWLEDGE_DOC_UPLOAD_FILESIZE_VS_QUOTA_MESSAGE).toContain('trained knowledge storage');
    expect(KNOWLEDGE_DOC_UPLOAD_FILESIZE_VS_QUOTA_MESSAGE).toContain('File upload size is separate');
  });

  it('preserves maximum upload file size label for upload helpers', () => {
    expect(MAX_KB_UPLOAD_FILE_SIZE_LABEL).toBe('Maximum file size: 20 MB');
    expect(CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE).toBe(MAX_KB_UPLOAD_FILE_SIZE_LABEL);
  });
});
