import { describe, expect, it } from "vitest";
import {
  DEFAULT_POWERED_BY_BRANDING_MESSAGE,
  resolveBrandingFooterDisplay,
} from "./resolveBrandingFooterDisplay";

describe("resolveBrandingFooterDisplay", () => {
  it("shows default Powered by Assistrio when branding is required and message empty", () => {
    expect(resolveBrandingFooterDisplay({ showBranding: true, brandingMessage: "" })).toEqual({
      showBrandingLine: true,
      brandingMessage: DEFAULT_POWERED_BY_BRANDING_MESSAGE,
    });
  });

  it("hides footer only when showBranding is explicitly false", () => {
    expect(resolveBrandingFooterDisplay({ showBranding: false, brandingMessage: "Custom" })).toEqual({
      showBrandingLine: false,
      brandingMessage: undefined,
    });
  });
});
