"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/hooks/useUser";

function safePostLoginPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith("/")) return "/admin/dashboard";
  if (nextParam.startsWith("//")) return "/admin/dashboard";
  let decoded = nextParam;
  try {
    decoded = decodeURIComponent(nextParam);
  } catch {
    return "/admin/dashboard";
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/admin/dashboard";
  const ok =
    decoded.startsWith("/admin") ||
    decoded.startsWith("/super-admin") ||
    decoded.startsWith("/user");
  return ok ? decoded : "/admin/dashboard";
}

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok || !data.success) {
        setError(typeof data.error === "string" ? data.error : "Login failed.");
        return;
      }

      await refetch();
      router.push(safePostLoginPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Unable to login right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h1 className="mb-2 text-2xl font-semibold">Assistrio — internal admin</h1>
        <p className="mb-6 text-sm text-slate-400">Platform administrators only (password sign-in).</p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="block text-sm text-slate-200" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 outline-none ring-slate-500 transition focus:ring-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm text-slate-200" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 outline-none ring-slate-500 transition focus:ring-2"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
