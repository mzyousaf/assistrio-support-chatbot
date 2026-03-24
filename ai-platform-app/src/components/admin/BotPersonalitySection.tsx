"use client";

import React, { useState } from "react";

import type { BotConfig, BotPersonality } from "@/models/Bot";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface BotPersonalitySectionProps {
  initialPersonality?: BotPersonality;
  initialConfig?: BotConfig;
  initialOpenaiApiKeyOverride?: string;
  onChange: (next: {
    personality: BotPersonality;
    config: BotConfig;
    openaiApiKeyOverride?: string;
  }) => void;
}

const defaultConfig: BotConfig = {
  temperature: 0.3,
  responseLength: "medium",
  maxTokens: 512,
};

function baseSelectClasses() {
  return "w-full bg-white border border-gray-300 dark:border-gray-700 dark:bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/40";
}

export default function BotPersonalitySection({
  initialPersonality,
  initialConfig,
  initialOpenaiApiKeyOverride,
  onChange,
}: BotPersonalitySectionProps) {
  const [personality, setPersonality] = useState<BotPersonality>(initialPersonality ?? {});
  const [config, setConfig] = useState<BotConfig>({
    ...defaultConfig,
    ...(initialConfig ?? {}),
  });
  const [openaiKeyOverride, setOpenaiKeyOverride] = useState(initialOpenaiApiKeyOverride ?? "");
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function emit(nextPersonality: BotPersonality, nextConfig: BotConfig, nextApiKey?: string) {
    setPersonality(nextPersonality);
    setConfig(nextConfig);
    onChange({
      personality: nextPersonality,
      config: nextConfig,
      openaiApiKeyOverride: nextApiKey?.trim() ? nextApiKey.trim() : undefined,
    });
  }

  function updateConfig(next: BotConfig) {
    emit(personality, next, openaiKeyOverride);
  }

  function updatePersonality(next: BotPersonality) {
    emit(next, config, openaiKeyOverride);
  }

  return (
    <Card title="Advanced">
      <div className="space-y-4">
        <section className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Model access</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configure which API key this bot should use.
            </p>
          </div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">OpenAI API key</label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Leave empty to use the default server key. Set a key only for this bot if needed.
          </p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="password"
              value={openaiKeyOverride}
              onChange={(event) => {
                const next = event.target.value;
                setOpenaiKeyOverride(next);
                emit(personality, config, next);
              }}
              placeholder="sk-..."
            />
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              disabled={testingKey}
              onClick={async () => {
                setTestingKey(true);
                setTestResult(null);
                try {
                  const res = await apiFetch("/api/user/openai/test-key", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ apiKey: openaiKeyOverride || "" }),
                  });
                  const data = (await res.json()) as { ok?: boolean; error?: string };
                  if (!res.ok || !data.ok) {
                    setTestResult({ ok: false, message: data.error || "Invalid API key" });
                  } else {
                    setTestResult({ ok: true, message: "API key is valid." });
                  }
                } catch {
                  setTestResult({ ok: false, message: "Failed to test API key." });
                } finally {
                  setTestingKey(false);
                }
              }}
            >
              {testingKey ? "Testing..." : "Test key"}
            </Button>
          </div>
          {testResult ? (
            <p className={`text-xs ${testResult.ok ? "text-green-600" : "text-red-500"}`}>
              {testResult.message}
            </p>
          ) : null}
        </section>

        <section className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Response controls</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tune language and response generation behavior.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 p-3">
            <label className="space-y-1 block md:col-span-2">
              <span className="text-sm text-gray-800 dark:text-gray-200">Language</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Preferred response language for this bot.
              </p>
              <select
                className={baseSelectClasses()}
                value={personality.language ?? ""}
                onChange={(event) =>
                  updatePersonality({
                    ...personality,
                    language: event.target.value || undefined,
                  })
                }
              >
                <option value="">Auto</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ar">Arabic</option>
                <option value="ur">Urdu</option>
                <option value="hi">Hindi</option>
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-sm text-gray-800 dark:text-gray-200">Creativity preset</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Control how strict vs creative answers should be.
              </p>
              <select
                className={baseSelectClasses()}
                value={String(config.temperature ?? 0.3)}
                onChange={(event) =>
                  updateConfig({
                    ...config,
                    temperature: Number(event.target.value),
                  })
                }
              >
                <option value="0.1">Low</option>
                <option value="0.3">Balanced</option>
                <option value="0.7">High</option>
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-sm text-gray-800 dark:text-gray-200">Answer length preset</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose how concise or detailed responses should be.
              </p>
              <select
                className={baseSelectClasses()}
                value={config.responseLength ?? "medium"}
                onChange={(event) =>
                  updateConfig({
                    ...config,
                    responseLength: event.target.value as BotConfig["responseLength"],
                  })
                }
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Detailed</option>
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="text-sm text-gray-800 dark:text-gray-200">Max tokens</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Maximum response size.
              </p>
              <Input
                type="number"
                value={config.maxTokens ?? 512}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  updateConfig({
                    ...config,
                    maxTokens: raw === "" ? 512 : Math.max(1, Math.floor(Number(raw))),
                  });
                }}
              />
            </label>
          </div>
        </section>
      </div>
    </Card>
  );
}
