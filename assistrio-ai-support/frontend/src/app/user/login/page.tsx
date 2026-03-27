"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function UserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/user/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok || !data.success) {
        setError(data.error ?? "Login failed.");
        return;
      }

      router.push("/user/dashboard");
      router.refresh();
    } catch {
      setError("Unable to login right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-brand-50/40 dark:from-gray-950 dark:via-gray-900 dark:to-brand-950/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-200/30 via-transparent to-transparent dark:from-brand-500/10" />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-lg shadow-brand-500/25">
            AI
          </div>
          <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Sign in to Assistrio
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Chatbase-style console for your support agents.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-8 shadow-xl shadow-gray-200/50 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90 dark:shadow-none">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none ring-brand-500/20 transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none ring-brand-500/20 transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Continue"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500">
          <Link href="/" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
