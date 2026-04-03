import Link from "next/link";
import { siteRoutes } from "@/content/site";

export default function BotNotFound() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">Demo not found</h1>
      <p className="mt-2 max-w-md text-neutral-600">
        This assistant may be unpublished or the link is incorrect.
      </p>
      <Link
        href={siteRoutes.bots}
        className="mt-8 inline-flex rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
      >
        Browse all demos
      </Link>
    </main>
  );
}
