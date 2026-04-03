"use client";

import { EmbedSubdomainLabelsList } from "./EmbedSubdomainLabelsList";
import { PublishInPageNav } from "./PublishInPageNav";
import { LaunchReadinessChecklist } from "@/components/admin/LaunchReadinessChecklist";
import { SettingsSectionCard, SettingsFieldRow } from "@/components/admin/settings";
import { SettingsEmbedPreview } from "@/components/admin/settings/SettingsEmbedPreview";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { AllowedDomainRowMode } from "@/lib/embedAllowedDomains";

import { useBotFormEditor } from "./BotFormEditorContext";
import { maskRuntimeKey } from "./botFormEditorUtils";
import { TAB_CONTENT_CLASS } from "./botFormUiConstants";

const PUBLISH_SURFACE =
  "!border-0 !shadow-none bg-white/90 ring-1 ring-slate-900/[0.04] dark:bg-slate-900/55 dark:ring-white/10";

function PublishWorkflowSteps() {
  const steps = [
    "Choose access mode",
    "Configure allowed domains",
    "Review conversation mode",
    "Review runtime keys",
    "Confirm readiness",
    "Publish or save draft",
  ];
  return (
    <ol className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {steps.map((label, i) => (
        <li
          key={label}
          className="flex gap-3 rounded-xl bg-white/70 py-3 pl-3 pr-2 ring-1 ring-teal-900/[0.05] dark:bg-slate-900/50 dark:ring-white/10"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
            {i + 1}
          </span>
          <span className="text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-300">{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function PublishSection() {
  const {
    mode,
    onCreateAnotherBot,
    isPublic,
    setIsPublic,
    visibility,
    setVisibility,
    maxAllowedDomains,
    allowedDomainRows,
    setAllowedDomainRows,
    emptyDomainRow,
    hasAllowedEmbedDomain,
    allowedEmbedDomainsPreviewBlocks,
    visitorMultiChatEnabled,
    setVisitorMultiChatEnabled,
    visitorMultiChatCapUnlimited,
    setVisitorMultiChatCapUnlimited,
    visitorMultiChatMax,
    setVisitorMultiChatMax,
    saveAccessSettings,
    accessActionLoading,
    accessActionMessage,
    accessKey,
    secretKey,
    secretKeyVisible,
    setSecretKeyVisible,
    setRotateKeyConfirm,
    copyRuntimeKey,
    creatorType,
    ownerVisitorId,
    botId,
    status,
    setStatus,
    launchReadinessModel,
    embedSnippetUnlocked,
    runtimeSnippet,
    snippetCopyMessage,
    setSnippetCopyMessage,
    isPublishBlocked,
    submitWithStatus,
  } = useBotFormEditor();

  return (
    <div className={TAB_CONTENT_CLASS}>
      <div className="mb-6 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800/80 dark:text-teal-400/90">
          Go live workflow
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Configure access, domains, conversation behavior, and keys—then publish when your readiness checklist is complete.
        </p>
      </div>

      <PublishWorkflowSteps />
      <PublishInPageNav />

      <section id="publish-access" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
          title="Access"
          description="Choose whether this bot is fully public (listed and embeddable with the access key only) or private."
        >
            <SettingsFieldRow
              label="Public access"
              htmlFor="bot-visibility-unified"
              helperText="Public: can be listed or discovered, and the embed snippet needs only the access key. Private: not for public listing; embedding requires the access key and secret key together."
            >
              <select
                id="bot-visibility-unified"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                value={isPublic && visibility === "public" ? "public" : "private"}
                onChange={(event) => {
                  const fullPublic = event.target.value === "public";
                  setIsPublic(fullPublic);
                  setVisibility(fullPublic ? "public" : "private");
                }}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </SettingsFieldRow>
          </SettingsSectionCard>
          </section>

      <section id="publish-domains" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
            title="Domains"
            description={
              maxAllowedDomains > 1
                ? 'Runtime embeds must match at least one rule below (up to 10). For "Main domain", enter your registrable host first, then list which subdomains are allowed—only those hostnames work; other subdomains are blocked. Use "Exact origin" for a single scheme + host + port. Required to publish; preview in the editor works without rules.'
                : 'Runtime embeds must match your rule below. Enter your main domain, then list allowed subdomain labels; only those hostnames are permitted. "Exact origin" allows only that origin. Required to publish.'
            }
          >
            <SettingsFieldRow
              label="Embed rules"
              htmlFor="allowed-embed-domain-0"
              helperText={
                maxAllowedDomains > 1
                  ? 'Main domain: e.g. example.com, then add each subdomain label one at a time (www → www.example.com). Check "Include apex" to allow example.com itself. Exact origin: full URL (e.g. https://example.com:3000). Do not use localhost or loopback; local testing uses server dev mode instead.'
                  : "Main domain first, then add subdomain labels one by one. Only listed hostnames match. Exact origin: full URL only. Do not use localhost or loopback here."
              }
            >
              <div className="flex flex-col gap-3">
                {allowedDomainRows.map((row, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-xl bg-slate-50/90 p-3 ring-1 ring-slate-900/[0.05] dark:bg-slate-900/45 dark:ring-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        id={index === 0 ? "allowed-embed-mode-0" : `allowed-embed-mode-${index}`}
                        className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        value={row.mode}
                        onChange={(e) => {
                          const mode = e.target.value as AllowedDomainRowMode;
                          setAllowedDomainRows((prev) => {
                            const next = [...prev];
                            next[index] =
                              mode === "exact"
                                ? { mode: "exact", value: "" }
                                : emptyDomainRow();
                            return next;
                          });
                        }}
                        aria-label="Match type"
                      >
                        <option value="domain">Main domain + subdomains</option>
                        <option value="exact">Exact origin</option>
                      </select>
                      {row.mode === "exact" ? (
                        <Input
                          id={index === 0 ? "allowed-embed-domain-0" : `allowed-embed-domain-${index}`}
                          type="text"
                          value={row.value}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAllowedDomainRows((prev) => {
                              const next = [...prev];
                              const cur = next[index];
                              if (cur?.mode === "exact") next[index] = { mode: "exact", value: v };
                              return next;
                            });
                          }}
                          placeholder="https://www.example.com:3000"
                          className="min-w-0 flex-1 font-mono text-sm"
                          autoComplete="off"
                        />
                      ) : null}
                      {maxAllowedDomains > 1 && allowedDomainRows.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto shrink-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          onClick={() =>
                            setAllowedDomainRows((prev) => {
                              const next = prev.filter((_, i) => i !== index);
                              return next.length < 1 ? [emptyDomainRow()] : next;
                            })
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    {row.mode === "domain" ? (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Main domain
                          <Input
                            id={index === 0 ? "allowed-embed-main-0" : `allowed-embed-main-${index}`}
                            type="text"
                            value={row.main}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAllowedDomainRows((prev) => {
                                const next = [...prev];
                                const cur = next[index];
                                if (cur?.mode === "domain")
                                  next[index] = { ...cur, main: v };
                                return next;
                              });
                            }}
                            placeholder="example.com"
                            className="mt-1 font-mono text-sm"
                            autoComplete="off"
                          />
                        </label>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-gray-300"
                            checked={row.includeApex}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setAllowedDomainRows((prev) => {
                                const next = [...prev];
                                const cur = next[index];
                                if (cur?.mode === "domain")
                                  next[index] = { ...cur, includeApex: on };
                                return next;
                              });
                            }}
                          />
                          <span>
                            Include apex hostname (
                            <span className="font-mono text-xs">
                              {row.main.trim() || "example.com"}
                            </span>
                            )
                          </span>
                        </label>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Subdomain labels
                          </span>
                          <EmbedSubdomainLabelsList
                            idPrefix={index === 0 ? "allowed-embed-0" : `allowed-embed-${index}`}
                            labels={row.subLabels}
                            onChange={(next) => {
                              setAllowedDomainRows((prev) => {
                                const copy = [...prev];
                                const cur = copy[index];
                                if (cur?.mode === "domain")
                                  copy[index] = { ...cur, subLabels: next };
                                return copy;
                              });
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Add each label (e.g. <span className="font-mono">www</span>, <span className="font-mono">app</span>) and press{" "}
                          <span className="font-medium">Add</span> or Enter. Only the apex (if enabled) and{" "}
                          <span className="font-mono">label.{row.main.trim() || "example.com"}</span> for each
                          label are allowed. Unlisted subdomains cannot embed the widget.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
                {maxAllowedDomains > 1 && allowedDomainRows.length < maxAllowedDomains ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => setAllowedDomainRows((prev) => [...prev, emptyDomainRow()])}
                  >
                    Add rule
                  </Button>
                ) : null}
              </div>
            </SettingsFieldRow>

            <div className="mt-6 space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Runtime origin preview
                </span>
                <span className="max-w-md text-xs text-gray-500 dark:text-gray-400">
                  After publish, the widget only loads when the page&apos;s origin matches one of these (or the
                  equivalent for main-domain rules — see note below).
                </span>
              </div>
              <SettingsEmbedPreview
                eyebrow="Allowed page origins"
                badge={
                  hasAllowedEmbedDomain ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300">
                      Publish-ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      Incomplete
                    </span>
                  )
                }
              >
                <div className="space-y-4">
                  {allowedEmbedDomainsPreviewBlocks.map((block) => (
                    <div key={block.key} className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {block.title}
                      </p>
                      {block.lines.length > 0 ? (
                        <ul className="list-none space-y-1 p-0 m-0">
                          {block.lines.map((line) => (
                            <li
                              key={line}
                              className="break-all font-mono text-[13px] leading-snug text-gray-800 dark:text-gray-200"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                          {block.hint}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Main domain</span> rules match
                    by hostname only —{" "}
                    <span className="font-mono">https://</span>, <span className="font-mono">http://</span>, and
                    any port on that host are allowed (e.g. <span className="font-mono">https://app.example.com:8443</span>
                    ). <span className="font-medium text-gray-700 dark:text-gray-300">Exact origin</span> matches
                    scheme, host, and port exactly.
                  </p>
                </div>
              </SettingsEmbedPreview>
            </div>
          </SettingsSectionCard>
          </section>

      <section id="publish-conversation-mode" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
              title="Conversation mode"
              description="How anonymous visitors use multiple conversation threads in the embedded widget. Use Save below to persist visibility and conversation limits without a full bot save."
            >
              <div className="space-y-4">
            <SettingsFieldRow
              label="Multiple conversations"
              htmlFor="visitor-multi-chat-enabled"
              helperText="Controls how the embed widget handles conversation history for anonymous visitors (runtime embed)."
            >
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  id="visitor-multi-chat-enabled"
                  type="checkbox"
                  className="mt-1 rounded border-gray-300"
                  checked={visitorMultiChatEnabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setVisitorMultiChatEnabled(on);
                    if (on) {
                      setVisitorMultiChatCapUnlimited(true);
                    }
                  }}
                />
                <span className="text-sm text-gray-800 dark:text-gray-100">
                  Allow multiple saved conversations per visitor
                </span>
              </label>
            </SettingsFieldRow>

            <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-3 text-xs leading-relaxed text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-medium text-sky-900 dark:text-sky-50">How it works in the widget</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sky-900/90 dark:text-sky-100/95">
                <li>
                  <span className="font-medium">Off (single active thread):</span> visitors always continue in
                  their <em>latest</em> conversation. Older threads appear under {"\u201c"}View recent chats{"\u201d"} as{" "}
                  <strong>read-only</strong> (they can open and read past messages but cannot send there).
                </li>
                <li>
                  <span className="font-medium">On (multiple saved threads):</span> visitors can open recent
                  threads and <strong>reply</strong> in any of them. {"\u201c"}Start a new chat{"\u201d"} and {"\u201c"}End chat{"\u201d"} only
                  appear while they are <strong>under</strong> the saved-conversation limit (unlimited = always
                  available).
                </li>
              </ul>
            </div>

            {visitorMultiChatEnabled ? (
              <SettingsFieldRow
                label="Saved conversations per visitor"
                htmlFor="visitor-cap-unlimited"
                helperText="Unlimited lets visitors keep any number of threads. With a limit, they cannot start a new thread once they reach the cap (they can still open existing threads)."
              >
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      id="visitor-cap-unlimited"
                      type="radio"
                      name="visitor-multi-chat-cap"
                      className="mt-1 border-gray-300"
                      checked={visitorMultiChatCapUnlimited}
                      onChange={() => setVisitorMultiChatCapUnlimited(true)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Unlimited
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        No maximum number of saved conversation threads per visitor.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      id="visitor-cap-limited"
                      type="radio"
                      name="visitor-multi-chat-cap"
                      className="mt-1 border-gray-300"
                      checked={!visitorMultiChatCapUnlimited}
                      onChange={() => setVisitorMultiChatCapUnlimited(false)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Set a maximum
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        Cap how many concurrent saved threads each visitor may have. Minimum 2—the current chat
                        counts as one.
                      </span>
                    </span>
                  </label>
                  {!visitorMultiChatCapUnlimited ? (
                    <div className="flex flex-wrap items-center gap-2 pl-7">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Up to</span>
                      <Input
                        id="visitor-multi-chat-max"
                        type="number"
                        min={2}
                        step={1}
                        className="w-24"
                        value={visitorMultiChatMax}
                        onChange={(e) => setVisitorMultiChatMax(e.target.value)}
                        aria-label="Maximum saved conversations per visitor"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        saved conversations
                      </span>
                    </div>
                  ) : null}
                </div>
              </SettingsFieldRow>
            ) : null}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/40">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Rotating the access or secret key updates the server immediately—you do not need to click save
                afterward for keys. Use this button only after changing{" "}
                <span className="font-medium">visibility</span> (above) or{" "}
                <span className="font-medium">conversation limits</span> here, and you want those
                persisted without using the main Save changes bar.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void saveAccessSettings()}
                  disabled={!botId || accessActionLoading !== null}
                >
                  {accessActionLoading === "save" ? "Saving..." : "Save visibility & limits"}
                </Button>
                {accessActionMessage ? (
                  <p className="text-xs text-gray-600 dark:text-gray-300">{accessActionMessage}</p>
                ) : null}
              </div>
            </div>

            </SettingsSectionCard>
          </section>

      <section id="publish-keys" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
              title="Keys"
              description="Runtime access and secret keys. Rotating a key applies immediately on the server."
            >
              <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SettingsFieldRow
                label="Access key"
                htmlFor="access-key-readonly"
                helperText="Used by public runtime init/chat access checks. Rotate applies immediately—no extra save."
              >
                <div className="flex items-center gap-2">
                  <Input id="access-key-readonly" value={accessKey} readOnly />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copyRuntimeKey("access")}
                    disabled={!accessKey}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRotateKeyConfirm("access")}
                    disabled={!botId || accessActionLoading !== null}
                  >
                    {accessActionLoading === "rotate-access" ? "Rotating..." : "Rotate"}
                  </Button>
                </div>
              </SettingsFieldRow>

              <SettingsFieldRow
                label="Secret key"
                htmlFor="secret-key-readonly"
                helperText="Required only when runtime visibility is private. Rotate applies immediately—no extra save."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="secret-key-readonly"
                    value={secretKeyVisible ? secretKey : maskRuntimeKey(secretKey)}
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSecretKeyVisible((v) => !v)}
                    disabled={!secretKey}
                  >
                    {secretKeyVisible ? "Hide" : "Reveal"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void copyRuntimeKey("secret")}
                    disabled={!secretKey}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRotateKeyConfirm("secret")}
                    disabled={!botId || accessActionLoading !== null}
                  >
                    {accessActionLoading === "rotate-secret" ? "Rotating..." : "Rotate"}
                  </Button>
                </div>
              </SettingsFieldRow>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Creator type</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {creatorType === "visitor" ? "Visitor" : "User"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Owner visitor ID</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {ownerVisitorId || "—"}
                </p>
              </div>
            </div>
              </div>
          </SettingsSectionCard>
          </section>

      <section id="publish-status" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
            title="Status"
            description="Draft: bot is saved but not listed or discoverable. Published: bot is live and available according to visibility settings."
          >
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400" id="publish-status-label">
                Bot status
              </p>
              <div
                className="inline-flex rounded-xl border-2 border-gray-200 bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-800/50"
                role="radiogroup"
                aria-labelledby="publish-status-label"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={status === "draft"}
                  className={`min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${status === "draft"
                    ? "border border-gray-300 bg-white text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  onClick={() => setStatus("draft")}
                >
                  Draft
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={status === "published"}
                  className={`min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${status === "published"
                    ? "border-2 border-brand-500 bg-brand-600 text-white shadow-sm dark:border-brand-400 dark:bg-brand-500"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  onClick={() => setStatus("published")}
                >
                  Published
                </button>
              </div>
            </div>
          </SettingsSectionCard>
          </section>

      <section id="publish-readiness" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
            title="Readiness checklist"
            description="Required items must be complete before publishing. Recommended items help you ship a stronger experience."
          >
            <LaunchReadinessChecklist
              required={launchReadinessModel.required}
              recommended={launchReadinessModel.recommended}
            />
          </SettingsSectionCard>
          </section>

      <section id="publish-snippet" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
            title="Embed snippet"
            description={
              embedSnippetUnlocked
                ? "Use this production runtime snippet on your website. It updates automatically when keys or visibility change."
                : "The production snippet is available after you publish. You can still use the live preview at the bottom of this page while editing."
            }
          >
            <div className="space-y-3">
              <Textarea
                readOnly
                value={
                  embedSnippetUnlocked
                    ? runtimeSnippet
                    : "Publish your bot (with at least one allowed embed domain) to enable the production snippet."
                }
                rows={10}
                disabled={!embedSnippetUnlocked}
                className={`font-mono text-xs ${!embedSnippetUnlocked ? "opacity-60" : ""}`}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!embedSnippetUnlocked}
                  onClick={async () => {
                    if (!embedSnippetUnlocked) return;
                    try {
                      await navigator.clipboard.writeText(runtimeSnippet);
                      setSnippetCopyMessage("Snippet copied.");
                    } catch {
                      setSnippetCopyMessage("Failed to copy snippet.");
                    }
                  }}
                >
                  Copy snippet
                </Button>
                {snippetCopyMessage ? (
                  <p className="text-xs text-gray-600 dark:text-gray-300">{snippetCopyMessage}</p>
                ) : null}
              </div>
            </div>
          </SettingsSectionCard>
          </section>

      <section id="publish-actions" className="scroll-mt-28">
        <SettingsSectionCard
          className={PUBLISH_SURFACE}
            title="Actions"
            description="Save as draft anytime. Publish when required readiness items are complete."
          >
            <div className="space-y-4">
              {isPublishBlocked ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  Resolve validation issues before publishing.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="primary"
                  disabled={isPublishBlocked}
                  onClick={() => void submitWithStatus("published")}
                >
                  Publish agent
                </Button>
                <Button type="button" variant="secondary" onClick={() => void submitWithStatus("draft")}>
                  Save draft
                </Button>
                {mode === "edit" && onCreateAnotherBot ? (
                  <Button type="button" variant="ghost" onClick={onCreateAnotherBot} className="text-gray-600 dark:text-gray-400">
                    Create new bot
                  </Button>
                ) : null}
              </div>
            </div>
          </SettingsSectionCard>
          </section>
        </div>

  );
}
