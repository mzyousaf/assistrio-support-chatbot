import { NextRequest, NextResponse } from "next/server";

/**
 * Demo-only echo endpoint for the Chat component demo page.
 * Returns the user message with a prefix so the Chat UI can be tested without the backend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message : "Hello";
    return NextResponse.json({
      assistantMessage: `Echo: ${message}`,
      sources: [
        {
          title: "Demo source",
          snippet: "This is a sample source for the chat demo.",
          score: 0.95,
        },
      ],
      conversationId: "demo-" + Date.now(),
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
