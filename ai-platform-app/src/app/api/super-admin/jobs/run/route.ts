import { NextRequest, NextResponse } from "next/server";

import { runQueuedIngestionJobs } from "@/lib/ingestionRunner";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";

type RunJobsBody = {
  limit?: number;
};

export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let limit = 3;
    try {
      const body = (await request.json()) as RunJobsBody;
      if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
        limit = Math.max(1, Math.floor(body.limit));
      }
    } catch {
      // Optional JSON body; default limit is used when absent.
    }

    const result = await runQueuedIngestionJobs(limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Run ingest jobs failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
