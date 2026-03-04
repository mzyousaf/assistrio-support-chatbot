import { connectToDatabase } from "@/lib/mongoose";
import { pingDb } from "@/lib/db-test";

type HealthStatus = {
  ok: boolean;
  dbName: string | null;
  error: string | null;
};

async function getHealthStatus(): Promise<HealthStatus> {
  try {
    const mongoose = await connectToDatabase();
    await pingDb();

    return {
      ok: true,
      dbName: mongoose.connection.db?.databaseName ?? null,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      dbName: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default async function HealthPage() {
  const status = await getHealthStatus();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
      <div className="w-full rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="mb-4 text-2xl font-semibold">Health Check</h1>

        <div className="space-y-2 text-sm">
          <p>
            Status:{" "}
            <span className={status.ok ? "text-emerald-400" : "text-red-400"}>
              {status.ok ? "OK" : "FAILED"}
            </span>
          </p>
          <p>Database: {status.dbName ?? "Not connected"}</p>
          {status.error ? <p className="text-red-400">Error: {status.error}</p> : null}
        </div>
      </div>
    </main>
  );
}
