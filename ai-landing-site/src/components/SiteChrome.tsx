import Link from "next/link";
import { siteRoutes } from "@/content/site";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200/90 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href={siteRoutes.home}
            className="text-base font-semibold tracking-tight text-neutral-900 transition hover:text-brand"
          >
            Assistrio
          </Link>
          <nav
            className="flex items-center gap-6 text-sm font-medium text-neutral-600 md:gap-8"
            aria-label="Main"
          >
            <Link
              href={siteRoutes.home}
              className="transition hover:text-neutral-900"
            >
              Home
            </Link>
            <Link
              href={siteRoutes.aiSupports}
              className="hidden transition hover:text-neutral-900 sm:inline"
            >
              AI Supports
            </Link>
            <Link href={siteRoutes.bots} className="transition hover:text-neutral-900">
              Demos
            </Link>
            <Link
              href={siteRoutes.createAgent}
              className="rounded-full bg-brand px-4 py-2 text-white shadow-sm transition hover:bg-brand-hover"
            >
              Create your agent
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-neutral-200/90 bg-neutral-50/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm text-neutral-600">
            © {new Date().getFullYear()} Assistrio. Custom AI support for your website.
          </p>
          <div className="flex flex-wrap gap-6 text-sm font-medium text-neutral-600">
            <Link href={siteRoutes.bots} className="hover:text-neutral-900">
              Browse demos
            </Link>
            <Link href={siteRoutes.contact} className="hover:text-neutral-900">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
