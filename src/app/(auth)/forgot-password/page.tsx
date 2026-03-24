"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    // Simulate sending email
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 1200);
  }

  return (
    <div>
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            className="text-primary"
          >
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path
              d="M16 7L23 12V20L16 25L9 20V12L16 7Z"
              fill="white"
              fillOpacity="0.9"
            />
            <path
              d="M16 12L19.5 14.5V19L16 21.5L12.5 19V14.5L16 12Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-xl font-bold text-foreground tracking-tight">
            Aexion <span className="font-normal">Core</span>
          </span>
        </div>
        <p className="text-sm text-muted">Reset your password</p>
      </div>

      {isSent ? (
        /* Success State */
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-success"
            >
              <path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Check your email
          </h2>
          <p className="mb-6 text-sm text-muted">
            We sent a password reset link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Click
            the link in the email to reset your password.
          </p>
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        /* Form State */
        <>
          <p className="mb-6 text-sm text-muted">
            Enter the email address associated with your account and we&apos;ll
            send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted/50 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-lg bg-primary font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
