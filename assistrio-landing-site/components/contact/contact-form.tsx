"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { Button } from "@/components/ui/button";
import { SITE_LOGO, SITE_LOGO_WORDMARK_PX } from "@/lib/site-branding";

const MAX = { name: 120, email: 254, subject: 200, message: 12_000 } as const;

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const fieldClass =
  "mt-1.5 w-full rounded-[var(--radius-md)] border bg-white px-3.5 py-3 text-[0.9375rem] text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] focus:border-[var(--border-teal-soft)] focus:ring-2 focus:ring-[var(--brand-teal)]/25";

const fieldOkClass = "border-[var(--border-default)]";
const fieldErrClass = "border-red-300 focus:border-red-400 focus:ring-red-200/40";

type FieldErrors = Partial<Record<"name" | "email" | "message", string>>;

type ContactFormProps = {
  /**
   * `split`: page supplies the main title and intro — omit centered wordmark and duplicate heading.
   * `standalone` (default): full header inside the form card (narrow pages).
   */
  variant?: "standalone" | "split";
  /** When `variant` is `split`, set to the page `<h1>` id for `aria-labelledby`. */
  labelledBy?: string;
};

export function ContactForm({ variant = "standalone", labelledBy }: ContactFormProps) {
  const formId = useId();
  const errNameId = `${formId}-err-name`;
  const errEmailId = `${formId}-err-email`;
  const errMessageId = `${formId}-err-message`;

  const { track } = useTrackEvent();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): boolean {
    const next: FieldErrors = {};
    const n = name.trim();
    const em = email.trim();
    const msg = message.trim();

    if (!n) next.name = "Enter your name.";
    else if (n.length > MAX.name) next.name = `Name must be under ${MAX.name} characters.`;

    if (!em) next.email = "Enter your email so we can reply.";
    else if (em.length > MAX.email || !emailOk(em)) next.email = "Enter a valid email address.";

    if (!msg) next.message = "Tell us what you need — even a short note is fine.";
    else if (msg.length > MAX.message) next.message = `Message is too long (max ${MAX.message.toLocaleString()} characters).`;

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!validate()) {
      setStatus("idle");
      return;
    }

    setStatus("sending");
    track("cta_clicked", { location: "contact_page", label: "contact_form_submit" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim().slice(0, MAX.subject),
          message: message.trim(),
          website: honeypot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setFieldErrors({});
      track("cta_clicked", { location: "contact_page", label: "contact_form_success" });
    } catch {
      setErrorMessage("Network error. Check your connection or email support@assistrio.com.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-2xl border border-[var(--border-teal-soft)] bg-[color-mix(in_srgb,var(--brand-teal-subtle)_40%,white)] px-6 py-12 text-center shadow-[var(--shadow-md)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_14%,transparent)] sm:px-10 sm:py-14"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-teal)] text-white shadow-[0_12px_32px_-8px_rgba(13,148,136,0.45)]" aria-hidden>
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="text-page-title mt-6 text-[1.5rem] sm:text-[1.75rem]">Message sent</p>
        <p className="mx-auto mt-4 max-w-md text-page-meta leading-relaxed">
          Thanks — we routed your note to <strong className="font-medium text-slate-800">support@assistrio.com</strong> and will reply to the address you provided. We typically
          respond within one to two business days.
        </p>
        <Button type="button" variant="secondary" className="mt-8" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  const isSplit = variant === "split";

  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-2xl border border-[var(--border-default)] bg-white/95 p-6 shadow-[var(--shadow-premium)] ring-1 ring-slate-900/[0.04] sm:p-9"
      noValidate
      aria-busy={status === "sending"}
      aria-labelledby={isSplit && labelledBy ? labelledBy : undefined}
    >
      {isSplit ? (
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Send a message</h2>
      ) : (
        <>
          <div className="flex justify-center">
            <Image
              src={SITE_LOGO.wordmark}
              alt="Assistrio"
              width={SITE_LOGO_WORDMARK_PX.width}
              height={SITE_LOGO_WORDMARK_PX.height}
              className="h-[22px] w-auto max-w-[min(85vw,14rem)] object-contain sm:h-6 sm:max-w-[16rem]"
            />
          </div>
          <h1 className="text-page-title mt-2 text-center">Contact us</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-page-meta leading-relaxed">
            Questions about Launch, Enterprise, or your workspace? Send a note — we read everything at{" "}
            <strong className="font-medium text-slate-800">support@assistrio.com</strong>.
          </p>
        </>
      )}

      <div className={`space-y-8 ${isSplit ? "mt-8" : "mt-10"}`}>
        <fieldset className="space-y-5">
          <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">Your details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="text-sm font-medium text-slate-800">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={MAX.name}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? errNameId : undefined}
                className={`${fieldClass} ${fieldErrors.name ? fieldErrClass : fieldOkClass}`}
                placeholder="Jane Doe"
              />
              {fieldErrors.name ? (
                <p id={errNameId} className="mt-1.5 text-sm text-red-700" role="alert">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="contact-email" className="text-sm font-medium text-slate-800">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={MAX.email}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? errEmailId : undefined}
                className={`${fieldClass} ${fieldErrors.email ? fieldErrClass : fieldOkClass}`}
                placeholder="you@company.com"
              />
              {fieldErrors.email ? (
                <p id={errEmailId} className="mt-1.5 text-sm text-red-700" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-5">
          <legend className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">Your message</legend>
          <div>
            <label htmlFor="contact-subject" className="text-sm font-medium text-slate-800">
              Subject <span className="font-normal text-[var(--foreground-muted)]">(optional)</span>
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              maxLength={MAX.subject}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={`${fieldClass} ${fieldOkClass}`}
              placeholder="e.g. Launch timeline, security questionnaire"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="contact-message" className="text-sm font-medium text-slate-800">
                Message <span className="text-red-600">*</span>
              </label>
              <span className="text-[0.7rem] text-[var(--foreground-muted)] tabular-nums" aria-live="polite">
                {message.length.toLocaleString()} / {MAX.message.toLocaleString()}
              </span>
            </div>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={6}
              maxLength={MAX.message}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (fieldErrors.message) setFieldErrors((p) => ({ ...p, message: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={fieldErrors.message ? errMessageId : undefined}
              className={`${fieldClass} min-h-[9rem] resize-y leading-relaxed ${fieldErrors.message ? fieldErrClass : fieldOkClass}`}
              placeholder="What would you like help with?"
            />
            {fieldErrors.message ? (
              <p id={errMessageId} className="mt-1.5 text-sm text-red-700" role="alert">
                {fieldErrors.message}
              </p>
            ) : null}
          </div>
        </fieldset>

        <div className="hidden" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
      </div>

      {status === "error" && errorMessage ? (
        <p className="mt-6 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm leading-snug text-red-900" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-8 flex justify-end border-t border-[var(--border-default)]/80 pt-8">
        <Button
          type="submit"
          disabled={status === "sending"}
          className="btn-primary-shimmer w-full justify-center px-8 py-3.5 text-[0.9375rem] shadow-[var(--shadow-sm)] ring-2 ring-[color-mix(in_srgb,var(--brand-teal)_18%,transparent)] sm:w-auto sm:min-w-[12rem]"
        >
          {status === "sending" ? "Sending…" : "Send message"}
        </Button>
      </div>
      <p className="mt-4 text-right text-[0.75rem] leading-snug text-[var(--foreground-muted)]">
        By sending, you agree we use your details only to respond to this inquiry.
      </p>
    </form>
  );
}
