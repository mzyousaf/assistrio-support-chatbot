import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-white p-8 shadow-[var(--shadow-dropdown)]">
        <div className="mb-5 leading-none">
          <img
            src="/logo-text.png"
            alt="Assistrio"
            width={160}
            height={30}
            className="block h-6 w-auto max-w-full object-contain object-left"
            decoding="async"
          />
        </div>
        <h1 className="mb-2 mt-0 text-[1.375rem] tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="mb-5 text-[0.9375rem] leading-[1.5] text-slate-400">
          That link doesn't match anything in your workspace.
        </p>
        <Link
          to="/bots"
          className="mb-3 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-[0.6rem] text-[0.9375rem] font-semibold text-white no-underline shadow-[var(--shadow-primary-fill)] transition-colors duration-100 hover:bg-[var(--teal-800)]"
        >
          Go to agents
        </Link>
        <Link
          to="/login"
          className="block text-center text-[0.875rem] text-slate-400 no-underline hover:text-primary"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
