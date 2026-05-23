import { describe, expect, it } from 'vitest';
import { emptyAgentCategoryValue } from '@/components/agent/categoryUtils';
import { buildOnboardingProfilePatchBody } from './onboardingProfilePatch';

describe('buildOnboardingProfilePatchBody', () => {
  it('includes local name, tagline, brand, and categories', () => {
    const body = buildOnboardingProfilePatchBody({
      name: 'Ada Bot',
      tagline: 'Always helpful',
      brandColor: '#112233',
      category: { selectedPredefined: ['support'], customMode: false, customText: '' },
      avatar: { imageUrl: '', avatarEmoji: '', avatarSource: 'none', pendingFile: null },
    });

    expect(body).toMatchObject({
      name: 'Ada Bot',
      shortDescription: 'Always helpful',
      brandColor: '#112233',
      categories: ['support'],
    });
  });

  it('omits empty name but keeps brand color and default category', () => {
    const body = buildOnboardingProfilePatchBody({
      name: '',
      tagline: 'Tag only',
      brandColor: '#AABBCC',
      category: emptyAgentCategoryValue(),
      avatar: { imageUrl: '', avatarEmoji: '', avatarSource: 'none', pendingFile: null },
    });

    expect(body).toMatchObject({
      shortDescription: 'Tag only',
      brandColor: '#AABBCC',
      categories: ['support'],
    });
    expect(body).not.toHaveProperty('name');
  });
});
