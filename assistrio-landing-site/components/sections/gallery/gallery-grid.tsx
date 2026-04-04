import { EmptyState } from "@/components/ui/empty-state";
import { GalleryDemoLink } from "@/components/sections/gallery/gallery-demo-link";
import type { PublicBotListItem } from "@/types/bot";

type Props = {
  bots: PublicBotListItem[];
};

/**
 * Public showcase bots only (`GET /api/public/bots`). Fields come from the API — no invented metadata.
 */
export function GalleryGrid({ bots }: Props) {
  if (bots.length === 0) {
    return (
      <EmptyState title="No showcase bots to display">
        <p>
          The API returned an empty list. Publish public showcase bots in the Assistrio admin, and ensure{" "}
          <code className="rounded bg-white px-1 text-xs">NEXT_PUBLIC_ASSISTRIO_API_BASE_URL</code> points at your
          backend.
        </p>
      </EmptyState>
    );
  }

  const countLabel = bots.length === 1 ? "1 demo" : `${bots.length} demos`;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 border-b border-[var(--border-default)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-eyebrow">Library</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Runtime-ready showcase bots</p>
          <p className="mt-1 max-w-2xl text-sm text-[var(--foreground-muted)]">
            Same public API as the homepage — categories and descriptions come from your backend.
          </p>
        </div>
        <p className="text-sm font-medium tabular-nums text-[var(--foreground-subtle)]">{countLabel}</p>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {bots.map((b) => (
          <li key={b.id}>
            <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--border-teal-soft)] hover:shadow-[var(--shadow-md)]">
              <div className="border-b border-[var(--border-default)] bg-gradient-to-br from-slate-50/90 to-white px-5 pb-4 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/90 text-2xl shadow-[var(--shadow-xs)]">
                    {b.avatarEmoji ?? "💬"}
                  </div>
                  {b.category ? (
                    <span className="rounded-full border border-[var(--border-default)] bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 shadow-[var(--shadow-xs)]">
                      {b.category}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-[var(--foreground-subtle)]">Showcase</span>
                  )}
                </div>
                <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-slate-900">
                  {b.name}
                </h2>
              </div>

              <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                {b.shortDescription ? (
                  <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--foreground-muted)]">
                    {b.shortDescription}
                  </p>
                ) : (
                  <p className="flex-1 text-sm italic text-slate-400">No short description</p>
                )}

                {b.exampleQuestions.length > 0 ? (
                  <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-slate-50/80 px-3 py-2.5">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Sample prompts</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
                      {b.exampleQuestions.slice(0, 2).join(" · ")}
                      {b.exampleQuestions.length > 2 ? "…" : ""}
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 border-t border-[var(--border-default)] pt-4">
                  <GalleryDemoLink slug={b.slug} botName={b.name} />
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
