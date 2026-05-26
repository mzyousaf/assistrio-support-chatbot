import { describe, expect, it } from "vitest";
import {
  AI_CREDITS_USAGE_UNAVAILABLE_CODE,
  AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE,
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_MESSAGE,
  resolveChatRuntimeErrorMessage,
} from "./resolveChatRuntimeErrorMessage";

describe("resolveChatRuntimeErrorMessage", () => {
  it("maps plan_limit_ai_credits to friendly copy", () => {
    expect(
      resolveChatRuntimeErrorMessage({
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        message: "Your workspace has used all AI credits for this billing period.",
      }),
    ).toBe(PLAN_LIMIT_AI_CREDITS_MESSAGE);
  });

  it("maps ai_credits_usage_unavailable to friendly copy", () => {
    expect(
      resolveChatRuntimeErrorMessage({
        errorCode: AI_CREDITS_USAGE_UNAVAILABLE_CODE,
        message: "Unable to verify AI credit usage. Please try again shortly.",
      }),
    ).toBe(AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE);
  });

  it("prefers mapped copy over raw backend message", () => {
    expect(
      resolveChatRuntimeErrorMessage({
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        error: "Your workspace has used all AI credits for this billing period.",
      }),
    ).toBe(PLAN_LIMIT_AI_CREDITS_MESSAGE);
  });
});
