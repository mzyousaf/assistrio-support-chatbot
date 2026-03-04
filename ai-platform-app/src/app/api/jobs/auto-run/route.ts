import { NextRequest, NextResponse } from "next/server";

import { runQueuedIngestionJobs } from "@/lib/ingestionRunner";

type AutoRunBody = {
  limit?: number;
};

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.JOB_RUNNER_SECRET;
    const providedHeaderSecret = request.headers.get("x-job-runner-secret");
    const providedQuerySecret = request.nextUrl.searchParams.get("secret");
    const isHeaderValid = Boolean(expectedSecret && providedHeaderSecret === expectedSecret);
    const isQueryValid = Boolean(expectedSecret && providedQuerySecret === expectedSecret);
    if (!isHeaderValid && !isQueryValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let limit = 3;
    try {
      const body = (await request.json()) as AutoRunBody;
      if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
        limit = Math.max(1, Math.floor(body.limit));
      }
    } catch {
      // Optional JSON body; default limit is used when absent.
    }

    const result = await runQueuedIngestionJobs(limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Auto-run ingest jobs failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
