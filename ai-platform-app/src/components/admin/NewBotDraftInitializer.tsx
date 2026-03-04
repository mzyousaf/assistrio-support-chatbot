"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ensureDraftId, rotateDraftId } from "@/lib/draftBot";

let draftInitInFlight:
  | {
    clientDraftId: string;
    promise: Promise<{ botId?: string }>;
  }
  | null = null;


export default function NewBotDraftInitializer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const isNew = searchParams.get("new") === "1";
        const clientDraftId = isNew ? rotateDraftId() : ensureDraftId();
        if (!clientDraftId) {
          throw new Error("Failed to create draft id.");
        }

        if (!draftInitInFlight || draftInitInFlight.clientDraftId !== clientDraftId) {
          draftInitInFlight = {
            clientDraftId,
            promise: (async () => {
              const response = await fetch("/api/super-admin/bots/draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientDraftId }),
              });
              if (!response.ok) {
                throw new Error("Failed to initialize draft bot.");
              }
              return (await response.json()) as { botId?: string };
            })(),
          };
        }

        const data = await draftInitInFlight.promise;
        if (!data.botId) {
          throw new Error("Draft bot id missing.");
        }
        if (mounted) {
          router.replace(`/super-admin/bots/${data.botId}`);
        }
      } catch {
        draftInitInFlight = null;
        if (mounted) {
          setError("Failed to initialize draft bot. Please reload and try again.");
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-700">Preparing your draft bot...</p>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
