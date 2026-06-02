import { describe, expect, it } from "vitest";
import {
  DEFAULT_POWERED_BY_BRANDING_MESSAGE,
  DEFAULT_PRIVACY_FOOTER_MESSAGE,
  resolveBrandingFooterDisplay,
  resolvePrivacyFooterDisplay,
} from "./resolveBrandingFooterDisplay";

describe("resolveBrandingFooterDisplay", () => {
  it("shows default Powered by Assistrio when showBranding is on and message empty", () => {
    expect(resolveBrandingFooterDisplay({ showBranding: true, brandingMessage: "" })).toEqual({
      showBrandingLine: true,
      brandingMessage: DEFAULT_POWERED_BY_BRANDING_MESSAGE,
    });
  });

  it("shows custom footer text when showBranding is on and message is set", () => {
    expect(resolveBrandingFooterDisplay({ showBranding: true, brandingMessage: "Custom footer" })).toEqual({
      showBrandingLine: true,
      brandingMessage: "Custom footer",
    });
  });

  it("hides footer only when showBranding is explicitly false", () => {
    expect(resolveBrandingFooterDisplay({ showBranding: false, brandingMessage: "Custom" })).toEqual({
      showBrandingLine: false,
      brandingMessage: undefined,
    });
  });
});

describe("resolvePrivacyFooterDisplay", () => {
  it("shows default privacy text when showPrivacyText is on and message empty", () => {
    expect(resolvePrivacyFooterDisplay({ showPrivacyText: true, privacyText: "" })).toEqual({
      showPrivacyLine: true,
      privacyText: DEFAULT_PRIVACY_FOOTER_MESSAGE,
    });
  });

  it("shows custom privacy text when showPrivacyText is on and message is set", () => {
    expect(
      resolvePrivacyFooterDisplay({ showPrivacyText: true, privacyText: "Custom privacy copy." }),
    ).toEqual({
      showPrivacyLine: true,
      privacyText: "Custom privacy copy.",
    });
  });

  it("uses footerPrivacyText fallback before default", () => {
    expect(resolvePrivacyFooterDisplay({ showPrivacyText: true, privacyText: "" }, "From API")).toEqual({
      showPrivacyLine: true,
      privacyText: "From API",
    });
  });

  it("hides privacy line only when showPrivacyText is explicitly false", () => {
    expect(resolvePrivacyFooterDisplay({ showPrivacyText: false, privacyText: "Custom" })).toEqual({
      showPrivacyLine: false,
      privacyText: undefined,
    });
  });
});
