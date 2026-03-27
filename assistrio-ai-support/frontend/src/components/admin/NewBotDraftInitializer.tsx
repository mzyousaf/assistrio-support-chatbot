"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { ensureDraftId } from "@/lib/draftBot";

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
        // Use the draft id already set by CreateNewBotButton (rotateDraftId) before navigation.
        // Do not call rotateDraftId() here — React Strict Mode runs this effect twice in dev, which
        // would generate two different ids and bypass draftInitInFlight, causing duplicate POST /draft.
        const clientDraftId = ensureDraftId();
        if (!clientDraftId) {
          throw new Error("Failed to create draft id.");
        }

        if (!draftInitInFlight || draftInitInFlight.clientDraftId !== clientDraftId) {
          draftInitInFlight = {
            clientDraftId,
            promise: (async () => {
              const response = await apiFetch("/api/user/bots/draft", {
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
          router.replace(`/user/bots/${data.botId}`);
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
