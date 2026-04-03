"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonFormFields } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";
import { useAdminUser } from "@/hooks/useAdminUser";

export default function AdminLimitsSettingsPage() {
  const { user, loading: authLoading } = useAdminUser();
  const [limits, setLimits] = useState<{ showcaseMessageLimit: number; ownBotMessageLimit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch("/api/user/settings/limits")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("Failed to load limits.");
          return;
        }
        const data = (await res.json()) as { showcaseMessageLimit: number; ownBotMessageLimit: number };
        setLimits(data);
      })
      .catch(() => setError("Failed to load limits."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!limits) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const showcaseMessageLimit = Math.max(0, Math.floor(Number(formData.get("showcaseMessageLimit")) || 0));
    const ownBotMessageLimit = Math.max(0, Math.floor(Number(formData.get("ownBotMessageLimit")) || 0));
    setSaving(true);
    try {
      const res = await apiFetch("/api/user/settings/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showcaseMessageLimit, ownBotMessageLimit }),
      });
      if (res.ok) {
        setLimits({ showcaseMessageLimit, ownBotMessageLimit });
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <AdminShell title="Settings">
        <SkeletonFormFields fields={2} />
      </AdminShell>
    );
  }

  if (error || (!loading && !limits)) {
    return (
      <AdminShell title="Settings">
        <p className="text-sm text-red-600">{error ?? "Failed to load limits."}</p>
      </AdminShell>
    );
  }

  if (loading || !limits) {
    return (
      <AdminShell title="Settings">
        <SkeletonFormFields fields={2} />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Settings">
      <section className="space-y-1">
        <p className="text-sm text-gray-600 dark:text-gray-400">Control how many free messages a visitor can send.</p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Set values to <span className="font-medium">0</span> to fully block free messages.
        </p>
      </section>

      <Card className="max-w-xl" title="Message Limits">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="showcaseMessageLimit">
              Showcase bots
            </label>
            <Input
              defaultValue={limits.showcaseMessageLimit}
              id="showcaseMessageLimit"
              min={0}
              name="showcaseMessageLimit"
              step={1}
              type="number"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="ownBotMessageLimit">
              Visitor&apos;s own bots
            </label>
            <Input
              defaultValue={limits.ownBotMessageLimit}
              id="ownBotMessageLimit"
              min={0}
              name="ownBotMessageLimit"
              step={1}
              type="number"
            />
          </div>

          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save limits"}</Button>
        </form>
      </Card>
    </AdminShell>
  );
}
