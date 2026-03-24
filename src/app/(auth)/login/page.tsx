"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else if (result?.ok) {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
        <p className="text-sm text-muted">Sign in to your account</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Form */}
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted/50 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="h-11 w-full rounded-lg bg-primary font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* SSO Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-background"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-background"
        >
          <svg width="20" height="20" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z" />
            <path fill="#81bc06" d="M12 1h10v10H12z" />
            <path fill="#05a6f0" d="M1 12h10v10H1z" />
            <path fill="#ffba08" d="M12 12h10v10H12z" />
          </svg>
          Continue with Microsoft
        </button>
      </div>

      {/* Demo credentials hint */}
      <div className="mt-6 rounded-lg border border-border bg-background p-3">
        <p className="mb-1 text-xs font-medium text-muted">Demo credentials:</p>
        <p className="text-xs text-muted">
          <span className="font-mono text-foreground">ana@aexion.io</span> / <span className="font-mono text-foreground">aexion123</span>
        </p>
      </div>

      {/* Footer */}
      <p className="mt-4 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:text-primary-hover transition-colors"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
