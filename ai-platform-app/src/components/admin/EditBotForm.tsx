"use client";
// Legacy component - not used by current flow (BotForm).

import React, { useState } from "react";
import Link from "next/link";

import type { BotConfig, BotFaq, BotPersonality } from "@/models/Bot";
import BotFaqsEditor from "@/components/admin/BotFaqsEditor";
import BotPersonalitySection from "@/components/admin/BotPersonalitySection";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type EditBotFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  initialValues: {
    name: string;
    slug: string;
    shortDescription?: string;
    category?: string;
    avatarEmoji?: string;
    imageUrl?: string;
    description?: string;
    faqs?: BotFaq[];
    isPublic: boolean;
    personality?: BotPersonality;
    config?: BotConfig;
  };
};

export default function EditBotForm({ action, initialValues }: EditBotFormProps) {
  const [faqs, setFaqs] = useState<BotFaq[]>(initialValues.faqs ?? []);
  const [personality, setPersonality] = useState<BotPersonality>(initialValues.personality ?? {});
  const [advancedConfig, setAdvancedConfig] = useState<BotConfig>({
    temperature: 0.3,
    responseLength: "medium",
    ...(initialValues.config ?? {}),
  });

  return (
    <form action={action} className="space-y-4">
      <label className="space-y-1 block">
        <span className="text-sm text-slate-200">Bot name</span>
        <Input required defaultValue={initialValues.name} id="name" name="name" type="text" />
        <p className="text-xs text-slate-500">Shown to users on the website and in chat.</p>
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-slate-200">Slug</span>
        <Input defaultValue={initialValues.slug} id="slug" name="slug" type="text" />
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-slate-200">Tagline (optional)</span>
        <Textarea
          defaultValue={initialValues.shortDescription || ""}
          id="shortDescription"
          name="shortDescription"
          rows={3}
        />
        <p className="text-xs text-slate-500">One-line summary shown under the bot name.</p>
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-slate-200">Category</span>
        <Input defaultValue={initialValues.category || ""} id="category" name="category" type="text" />
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-slate-200">Avatar emoji (max 3 chars)</span>
        <Input
          maxLength={3}
          defaultValue={initialValues.avatarEmoji || ""}
          id="avatarEmoji"
          name="avatarEmoji"
          type="text"
        />
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-slate-200">Image URL</span>
        <Input defaultValue={initialValues.imageUrl || ""} id="imageUrl" name="imageUrl" type="url" />
      </label>

      <label className="space-y-1 block">
        <span className="text-sm text-slate-200">Internal notes (optional)</span>
        <Textarea defaultValue={initialValues.description || ""} id="description" name="description" rows={6} />
        <p className="text-xs text-slate-500">For admins only. Not shown to end users.</p>
      </label>

      <BotPersonalitySection
        initialPersonality={initialValues.personality ?? {}}
        initialConfig={{
          temperature: 0.3,
          responseLength: "medium",
          ...(initialValues.config ?? {}),
        }}
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
          className="h-4 w-4 rounded border-slate-700 bg-slate-900"
          defaultChecked={initialValues.isPublic}
          name="isPublic"
          type="checkbox"
        />
        Public bot
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary">
          Save changes
        </Button>
        <Link className="text-sm text-slate-300 hover:text-slate-100 underline" href="/super-admin/bots">
          Back to bots
        </Link>
      </div>
    </form>
  );
}
