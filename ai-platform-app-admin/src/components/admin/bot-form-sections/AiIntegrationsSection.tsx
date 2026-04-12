"use client";

import {
  SettingsPageHeader,
  SettingsSectionCard,
  SettingsGrid,
  SettingsFieldRow,
  SettingsEmptyState,
  SettingsDependencyAlert,
} from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";

import { useBotFormEditor } from "./BotFormEditorContext";
import { TAB_CONTENT_CLASS, TAB_META } from "./botFormUiConstants";

export function AiIntegrationsSection() {
  const {
    openaiApiKeyOverride,
    setOpenaiApiKeyOverride,
    testingKey,
    setTestingKey,
    testResult,
    setTestResult,
    personality,
    setPersonality,
    config,
    setConfig,
    whisperApiKeyOverride,
    setWhisperApiKeyOverride,
    chatUI,
  } = useBotFormEditor();

  return (
    <div className={TAB_CONTENT_CLASS}>
      <SettingsPageHeader title={TAB_META.integrations.title} description={TAB_META.integrations.description} />
      <SettingsSectionCard
        title="AI Provider"
        description="OpenAI API key and model parameters for this bot."
      >
        <div className="space-y-4">
          <SettingsFieldRow
            label="OpenAI API key override"
            htmlFor="openai-api-key"
            helperText="Leave blank to use the account default. Stored securely."
          >
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="openai-api-key"
                  type="password"
                  value={openaiApiKeyOverride}
                  onChange={(event) => setOpenaiApiKeyOverride(event.target.value)}
                  placeholder="sk-..."
                  className="min-w-0 flex-1"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0 sm:self-stretch"
                  disabled={testingKey || !openaiApiKeyOverride?.trim()}
                  onClick={async () => {
                    setTestingKey(true);
                    setTestResult(null);
                    try {
                      const response = await apiFetch("/api/user/openai/test-key", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ apiKey: openaiApiKeyOverride || "" }),
                      });
                      const data = (await response.json()) as { ok?: boolean; error?: string };
                      if (!response.ok || !data.ok) {
                        setTestResult({ ok: false, message: data.error || "Invalid API key." });
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
                  {testingKey ? "Testing…" : "Test key"}
                </Button>
              </div>
              {testResult ? (
                <p
                  className={`text-xs ${testResult.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
                >
                  {testResult.message}
                </p>
              ) : !openaiApiKeyOverride?.trim() ? (
                <SettingsDependencyAlert>Enter a key above to test.</SettingsDependencyAlert>
              ) : null}
            </div>
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Language"
            htmlFor="ai-language"
            helperText="e.g. en-US. Affects model instructions when set."
          >
            <Input
              id="ai-language"
              value={personality.language ?? ""}
              onChange={(event) =>
                setPersonality((prev) => ({ ...prev, language: event.target.value || undefined }))
              }
              placeholder="en-US"
              className="max-w-xs"
            />
          </SettingsFieldRow>
          <SettingsGrid>
            <SettingsFieldRow
              label="Temperature"
              htmlFor="ai-temperature"
              tooltip="Lower values produce more predictable responses; higher values more varied."
            >
              <Input
                id="ai-temperature"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={config.temperature ?? 0.3}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, temperature: Number(event.target.value) }))
                }
                className="w-24"
              />
            </SettingsFieldRow>
            <SettingsFieldRow
              label="Max tokens"
              htmlFor="ai-max-tokens"
              tooltip="Maximum length of each model response in tokens."
            >
              <Input
                id="ai-max-tokens"
                type="number"
                min={1}
                value={config.maxTokens ?? 512}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, maxTokens: Math.max(1, Number(event.target.value)) }))
                }
                className="w-24"
              />
            </SettingsFieldRow>
          </SettingsGrid>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Voice Configuration"
        description="Whisper API key for voice-to-text when the mic is enabled in Chat Experience."
      >
        <div className="space-y-4">
          <SettingsFieldRow
            label="Whisper API key"
            htmlFor="whisper-api-key"
            helperText="Use your OpenAI API key or an endpoint-specific key. Leave blank to use the main OpenAI key."
            disabled={chatUI.showMic !== true}
            dependencyNote={
              chatUI.showMic !== true ? "Enable the microphone in Chat Experience to configure this setting." : undefined
            }
          >
            <Input
              id="whisper-api-key"
              type="password"
              value={whisperApiKeyOverride}
              disabled={chatUI.showMic !== true}
              onChange={(e) => setWhisperApiKeyOverride(e.target.value)}
              placeholder="sk-... or leave blank to use main OpenAI key"
              autoComplete="off"
            />
          </SettingsFieldRow>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Future Integrations"
        description="Webhooks, CRM, and channels will be configurable here when available."
      >
        <SettingsEmptyState
          title="Coming soon"
          description="External integrations such as webhooks, CRM connections, and channels can be added here later."
        />
      </SettingsSectionCard>
    </div>
  );
}
