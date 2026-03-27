"use client";
// Legacy component - not used by current flow (BotForm).

import React, { useState } from "react";
import Link from "next/link";

import type { BotConfig, BotPersonality } from "@/models/Bot";
import BotFaqsEditor, { type BotFaq } from "@/components/admin/BotFaqsEditor";
import BotPersonalitySection from "@/components/admin/BotPersonalitySection";
import { Button } from "@/components/ui/Button";

type NewBotFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export default function NewBotForm({ action }: NewBotFormProps) {
  const [faqs, setFaqs] = useState<BotFaq[]>([]);
  const [personality, setPersonality] = useState<BotPersonality>({});
  const [advancedConfig, setAdvancedConfig] = useState<BotConfig>({
    temperature: 0.3,
    responseLength: "medium",
  });

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-200" htmlFor="name">
          Bot name
        </label>
        <input
          required
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-600 placeholder:text-slate-500 focus:ring-1"
          id="name"
          name="name"
          type="text"
        />
        <p className="text-xs text-slate-500">Shown to users on the website and in chat.</p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-200" htmlFor="slug">
          Slug (optional)
        </label>
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-600 placeholder:text-slate-500 focus:ring-1"
          id="slug"
          name="slug"
          type="text"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-200" htmlFor="shortDescription">
          Tagline (optional)
        </label>
        <textarea
          className="min-h-24 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-600 placeholder:text-slate-500 focus:ring-1"
          id="shortDescription"
          name="shortDescription"
        />
        <p className="text-xs text-slate-500">One-line summary shown under the bot name.</p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-200" htmlFor="category">
          Category (optional)
        </label>
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-600 placeholder:text-slate-500 focus:ring-1"
          id="category"
          name="category"
          type="text"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-200" htmlFor="avatarEmoji">
          Avatar emoji (optional, max 3 chars)
        </label>
        <input
          maxLength={3}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-600 placeholder:text-slate-500 focus:ring-1"
          id="avatarEmoji"
          name="avatarEmoji"
          type="text"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-200" htmlFor="imageUrl">
          Image URL (optional)
        </label>
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-600 placeholder:text-slate-500 focus:ring-1"
          id="imageUrl"
          name="imageUrl"
          type="url"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-200" htmlFor="description">
          Internal notes (optional)
        </label>
        <textarea
          className="min-h-32 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-slate-600 placeholder:text-slate-500 focus:ring-1"
          id="description"
          name="description"
        />
        <p className="text-xs text-slate-500">For admins only. Not shown to end users.</p>
      </div>

      <BotPersonalitySection
        initialPersonality={{}}
        initialConfig={{ temperature: 0.3, responseLength: "medium" }}
        onChange={({ personality: nextPersonality, config }) => {
          setPersonality(nextPersonality);
          setAdvancedConfig(config);
        }}
      />

      <BotFaqsEditor value={faqs} onChange={setFaqs} />

      <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />
      <input type="hidden" name="personality" value={JSON.stringify(personality)} />
      <input type="hidden" name="config" value={JSON.stringify(advancedConfig)} />

      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
        <input
          defaultChecked
          className="h-4 w-4 rounded border-slate-700 bg-slate-900"
          name="isPublic"
          type="checkbox"
        />
        Public bot
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary">
          Create bot
        </Button>
        <Link className="text-sm text-slate-300 underline" href="/user/bots">
          Back to bots
        </Link>
      </div>
    </form>
  );
}
