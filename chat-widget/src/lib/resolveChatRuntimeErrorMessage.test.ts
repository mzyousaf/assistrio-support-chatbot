import { describe, expect, it } from "vitest";
import {
  AI_CREDITS_USAGE_UNAVAILABLE_CODE,
  AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE,
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_MESSAGE,
  WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
  WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
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

  it("maps workspace_bot_limit_exceeded to inactive-agent copy", () => {
    expect(
      resolveChatRuntimeErrorMessage({
        errorCode: WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
        message: "This agent is inactive because your workspace is over its agent limit.",
      }),
    ).toBe(WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE);
  });

  it("maps plan_limit_share_preview to inactive preview copy", () => {
    expect(
      resolveChatRuntimeErrorMessage({
        errorCode: "plan_limit_share_preview",
        message: "Share preview links are available on paid plans.",
      }),
    ).toBe("This preview link is no longer active. Please contact the workspace owner.");
  });
});
