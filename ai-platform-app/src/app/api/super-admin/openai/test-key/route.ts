import OpenAI from "openai";
import { NextResponse } from "next/server";

import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";

type TestKeyRequestBody = {
  apiKey?: string;
};

export async function POST(request: Request) {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as TestKeyRequestBody;
    const overrideKey = body.apiKey?.trim() ?? "";
    const keyToTest = overrideKey || process.env.OPENAI_API_KEY || "";

    if (!keyToTest) {
      return NextResponse.json(
        { ok: false, error: "No API key configured to test." },
        { status: 400 },
      );
    }

    try {
      const client = new OpenAI({ apiKey: keyToTest });
      await client.models.list();
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid API key" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to test API key." }, { status: 500 });
  }
}
