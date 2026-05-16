import { Suspense } from "react";

import { AdminLoginForm } from "./admin-login-form";

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h1 className="mb-2 text-2xl font-semibold text-slate-50">Assistrio — internal admin</h1>
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <AdminLoginForm />
    </Suspense>
  );
}
