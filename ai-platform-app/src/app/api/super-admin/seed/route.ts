// TODO: REMOVE THIS ROUTE AFTER INITIAL SUPER ADMIN SEEDING
// TODO: REMOVE THIS ROUTE AFTER INITIAL SUPER ADMIN SEEDING
// TODO: REMOVE THIS ROUTE AFTER INITIAL SUPER ADMIN SEEDING

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSuperAdmin } from "@/lib/superAdminAuth";

const seedSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  seedSecret: z.string(),
});
const SEED_ROUTE_ENABLED = false;

export async function POST(request: NextRequest) {
  if (!SEED_ROUTE_ENABLED) {
    return NextResponse.json(
      {
        success: false,
        error:
          "This seed route is disabled. Re-enable temporarily only when intentionally seeding.",
      },
      { status: 410 },
    );
  }

  try {
    const configuredSeedSecret = process.env.SEED_SUPERADMIN_SECRET;
    if (!configuredSeedSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing SEED_SUPERADMIN_SECRET environment variable. Set it before using this route.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as unknown;
    const parsed = seedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 },
      );
    }

    const { email, password, seedSecret } = parsed.data;

    if (seedSecret !== configuredSeedSecret) {
      return NextResponse.json(
        { success: false, error: "Forbidden: invalid seed secret." },
        { status: 403 },
      );
    }

    try {
      await createSuperAdmin(email, password);
      return NextResponse.json({ success: true, created: true });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("already exists")
      ) {
        return NextResponse.json({ success: true, created: false });
      }

      throw error;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to seed super admin.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
