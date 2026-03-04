import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

import { getLimitsConfig, updateLimitsConfig } from "@/lib/limits";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";

function parseLimitValue(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export default async function SuperAdminLimitsSettingsPage() {
  const user = await getAuthenticatedSuperAdmin();

  if (!user) {
    redirect("/super-admin/login");
  }

  const limits = await getLimitsConfig();

  async function saveLimits(formData: FormData) {
    "use server";

    const admin = await getAuthenticatedSuperAdmin();
    if (!admin) {
      redirect("/super-admin/login");
    }

    const currentLimits = await getLimitsConfig();
    const showcaseMessageLimit = parseLimitValue(
      formData.get("showcaseMessageLimit"),
      currentLimits.showcaseMessageLimit,
    );
    const ownBotMessageLimit = parseLimitValue(
      formData.get("ownBotMessageLimit"),
      currentLimits.ownBotMessageLimit,
    );

    await updateLimitsConfig({ showcaseMessageLimit, ownBotMessageLimit });
    revalidatePath("/super-admin/settings/limits");
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
        <form action={saveLimits} className="space-y-4">
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

          <Button type="submit">Save limits</Button>
        </form>
      </Card>
    </AdminShell>
  );
}
