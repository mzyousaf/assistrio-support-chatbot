import {
  isLegacyKbAddonKey,
  WORKSPACE_ADDON_CATALOG,
  WORKSPACE_ADDON_KEYS,
} from './addon-catalog';

describe('addon-catalog', () => {
  it('does not include retired KB storage add-ons in the product catalog', () => {
    expect(WORKSPACE_ADDON_KEYS).toEqual(['ai_credits_1000', 'extra_bot', 'remove_branding']);
    expect(WORKSPACE_ADDON_CATALOG.map((addon) => addon.key)).toEqual([
      'ai_credits_1000',
      'extra_bot',
      'remove_branding',
    ]);
    expect(WORKSPACE_ADDON_CATALOG.some((addon) => isLegacyKbAddonKey(addon.key))).toBe(false);
  });

  it('recognizes legacy KB add-on keys for admin and migration handling', () => {
    expect(isLegacyKbAddonKey('kb_storage_5mb')).toBe(true);
    expect(isLegacyKbAddonKey('kb_storage_10mb')).toBe(true);
    expect(isLegacyKbAddonKey('extra_bot')).toBe(false);
  });
});
