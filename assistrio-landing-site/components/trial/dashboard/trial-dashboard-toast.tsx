"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type TrialDashboardToastVariant = "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: TrialDashboardToastVariant;
};

type ShowToastOptions = {
  message: string;
  variant?: TrialDashboardToastVariant;
  /** Default: 4s success, 8s error */
  durationMs?: number;
};

type TrialDashboardToastContextValue = {
  showToast: (opts: ShowToastOptions) => void;
  dismissToast: (id: string) => void;
};

const TrialDashboardToastContext = createContext<TrialDashboardToastContextValue | null>(null);

function newToastId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TrialDashboardToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  /** DOM timers — use `window.*` so typings stay numeric (avoids Node `Timeout` vs `number`). */
  const timeoutByIdRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return () => {
      timeoutByIdRef.current.forEach((tid) => window.clearTimeout(tid));
      timeoutByIdRef.current.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    const tid = timeoutByIdRef.current.get(id);
    if (tid !== undefined) {
      window.clearTimeout(tid);
      timeoutByIdRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (opts: ShowToastOptions) => {
      const id = newToastId();
      const variant = opts.variant ?? "error";
      const durationMs =
        opts.durationMs ?? (variant === "error" ? 8000 : 4000);
      setToasts((prev) => [...prev, { id, message: opts.message, variant }]);
      const tid = window.setTimeout(() => {
        timeoutByIdRef.current.delete(id);
        dismissToast(id);
      }, durationMs) as unknown as number;
      timeoutByIdRef.current.set(id, tid);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <TrialDashboardToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-[calc(var(--trial-header-h,3.5rem)+0.75rem)] z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((t) => (
            <ToastSurface key={t.id} item={t} onDismiss={() => dismissToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </TrialDashboardToastContext.Provider>
  );
}

function ToastSurface({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const labelId = useId();
  const descId = useId();
  const isError = item.variant === "error";
  const heading = isError ? "Something went wrong" : "Success";

  return (
    <motion.div
      layout
      role={isError ? "alert" : "status"}
      aria-labelledby={labelId}
      aria-describedby={descId}
      initial={{ opacity: 0, x: 48, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
      className={`pointer-events-auto w-full overflow-hidden rounded-xl border shadow-[var(--shadow-premium)] backdrop-blur-md ${
        isError
          ? "border-red-200/95 bg-white/95 text-red-950 ring-1 ring-red-500/10"
          : "border-emerald-200/95 bg-white/95 text-emerald-950 ring-1 ring-emerald-500/10"
      }`}
    >
      <div className="flex gap-0">
        <div
          className={`w-1 shrink-0 ${isError ? "bg-red-500" : "bg-[var(--brand-teal)]"}`}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-3.5 pr-2">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isError ? "bg-red-50 text-red-600" : "bg-emerald-50 text-[var(--brand-teal-dark)]"
            }`}
            aria-hidden
          >
            {isError ? (
              <AlertCircle className="h-[18px] w-[18px]" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2} />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p
              id={labelId}
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                isError ? "text-red-800/90" : "text-emerald-900/85"
              }`}
            >
              {heading}
            </p>
            <p
              id={descId}
              className={`mt-1 text-[13px] leading-snug ${
                isError ? "text-red-950/95" : "text-slate-800"
              }`}
            >
              {item.message}
            </p>
          </div>
          <button
            type="button"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              isError
                ? "text-red-700/75 hover:bg-red-50 hover:text-red-950"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
            aria-label="Dismiss notification"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function useTrialDashboardToast(): TrialDashboardToastContextValue {
  const ctx = useContext(TrialDashboardToastContext);
  if (!ctx) {
    throw new Error("useTrialDashboardToast must be used within TrialDashboardToastProvider");
  }
  return ctx;
}
