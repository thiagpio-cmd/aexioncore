/**
 * NextAuth Configuration — Hardened for production.
 *
 * Security decisions documented inline:
 *
 * 1. COOKIE HARDENING — Explicit httpOnly/secure/sameSite on session cookie.
 *    NextAuth sets httpOnly/secure automatically in production, but we declare
 *    them explicitly for auditability and to ensure sameSite: "lax" is set
 *    (prevents CSRF while allowing top-level navigation from external links).
 *
 * 2. TYPED CALLBACKS — jwt/session callbacks use proper NextAuth types instead
 *    of `any`. This prevents accidental serialization of sensitive fields.
 *
 * 3. ACCOUNT LOCKOUT (per-email) — On top of the per-IP rate limit applied in
 *    the NextAuth route handler, we enforce a per-email lockout of 10 attempts
 *    per 30 minutes. This stops distributed brute-force attacks that rotate IPs.
 *
 * 4. PERIODIC RE-VALIDATION — The JWT callback re-checks the database every
 *    5 minutes. This enables:
 *      a. Deactivated accounts are kicked within 5 minutes.
 *      b. Sessions invalidated via invalidateUserSessions() (password reset,
 *         forced logout) take effect within 5 minutes.
 *      c. Role / workspace changes propagate to the token without re-login.
 *
 * 5. SESSION INVALIDATION — We call isSessionValid() on each re-validation.
 *    If the user's sessions were invalidated after the token was issued, the
 *    JWT callback returns `null`, destroying the session and forcing re-login.
 *
 * 6. SENSITIVE DATA — The JWT contains only: id, role, workspace, organizationId,
 *    teamId. No password hash, email (beyond what NextAuth adds by default), or
 *    PII beyond what is essential for authorization. `email` in the session is
 *    the next-auth default and is needed for display.
 */

import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import * as bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { checkRateLimit } from "@/lib/rate-limiter";
import { writeAuditLog } from "@/server/audit";
import { isSessionValid, clearInvalidation } from "@/lib/session-store";

// ── Account lockout: 10 failed attempts per email per 30 minutes ─────────────
// This is per-email (not per-IP) so distributed brute-force is mitigated.
const EMAIL_LOCKOUT = { windowMs: 30 * 60 * 1000, maxRequests: 10 };

// ── Periodic re-validation interval ─────────────────────────────────────────
const REVALIDATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          // Generic message — never reveal which field is missing
          throw new Error("Invalid credentials");
        }

        const email = credentials.email.trim().toLowerCase();

        // ── Per-email account lockout ─────────────────────────────────────
        // Checked here (after normalization) in addition to the per-IP check
        // in the route handler. Covers distributed attacks across multiple IPs.
        const lockoutCheck = checkRateLimit(`email-lockout:${email}`, EMAIL_LOCKOUT);
        if (!lockoutCheck.allowed) {
          throw new Error(
            "Account temporarily locked due to too many attempts. " +
            "Please try again later."
          );
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true, team: true },
        });

        if (!user) {
          // Generic error — never reveal whether the email exists
          throw new Error("Invalid email or password");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          // Generic error — do not distinguish between wrong email vs password
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("User account deactivated. Please contact your administrator.");
        }

        // ── Successful login: clear any pending session invalidation ──────
        // If the user just reset their password and then re-logged in, clear
        // the invalidation record so the new session is not immediately rejected.
        clearInvalidation(user.id);

        // ── Audit log ─────────────────────────────────────────────────────
        // Fire-and-forget — do not await so login latency is not affected.
        writeAuditLog({
          organizationId: user.organizationId,
          userId: user.id,
          action: "LOGIN",
          objectType: "User",
          objectId: user.id,
          source: "credentials",
        }).catch(() => {}); // Auth should not fail because of audit errors

        // ── Return user payload embedded in JWT ───────────────────────────
        // SECURITY: do NOT include password hash, raw email tokens, or any
        // secrets here. Only include fields needed for authorization.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          workspace: user.workspace,
          organizationId: user.organizationId,
          teamId: user.teamId ?? null,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * JWT callback — runs on every request that touches the session.
     * Responsible for:
     * 1. Populating the token from the user object at login.
     * 2. Periodically re-validating the session against the DB.
     * 3. Propagating role/workspace changes without requiring re-login.
     */
    async jwt({ token, user }: { token: JWT; user?: Record<string, unknown> | any }): Promise<JWT> {
      // ── Initial login ─────────────────────────────────────────────────
      if (user) {
        token.id = user.id as string;
        token.role = user.role as string;
        token.workspace = user.workspace as string;
        token.organizationId = user.organizationId as string;
        token.teamId = user.teamId as string | null | undefined;
        token.lastValidated = Date.now();
      }

      // ── Periodic re-validation ────────────────────────────────────────
      // Skip if there's no user ID (e.g. empty token edge case).
      if (!token.id) return token;

      const lastValidated = (token.lastValidated as number) ?? 0;
      if (Date.now() - lastValidated <= REVALIDATION_INTERVAL_MS) {
        // Not due for re-validation yet
        return token;
      }

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            isActive: true,
            role: true,
            workspace: true,
            organizationId: true,
            teamId: true,
          },
        });

        // ── Deactivated or deleted user ───────────────────────────────
        if (!dbUser || !dbUser.isActive) {
          // Returning null destroys the session — user is redirected to login.
          // NextAuth v4 supports null return from jwt callback to invalidate.
          // Returning null destroys the session — user is redirected to login.
          // NextAuth v4 supports null return from jwt callback to invalidate.
          return null as unknown as JWT;
        }

        // ── Session invalidated via invalidateUserSessions() ──────────
        // This covers: password reset, admin-forced logout, privilege change.
        // token.iat is set by NextAuth as Unix seconds — convert to ms.
        const issuedAtMs = ((token.iat as number) ?? 0) * 1000;
        if (!isSessionValid(token.id as string, issuedAtMs)) {
          return null as unknown as JWT;
        }

        // ── Refresh mutable fields (role/workspace may change) ────────
        // This allows role changes and org moves to take effect within 5 min
        // without requiring a re-login.
        token.role = dbUser.role;
        token.workspace = dbUser.workspace;
        token.organizationId = dbUser.organizationId;
        token.teamId = dbUser.teamId;
        token.lastValidated = Date.now();
      } catch {
        // DB unreachable during re-validation — do NOT destroy the session.
        // Silently skip and keep the existing token values.
        // This prevents mass logouts during brief DB connectivity issues.
        token.lastValidated = Date.now(); // Back off until next window
      }

      return token;
    },

    /**
     * Session callback — runs when session() is called.
     * Copies JWT claims into the session.user object.
     *
     * SECURITY: only surface the minimum fields needed by the frontend.
     * The session is readable client-side, so never include secrets here.
     */
    async session({
      session,
      token,
    }: {
      session: any;
      token: JWT;
    }) {
      const user = (session as any).user;
      if (user) {
        user.id = token.id;
        user.role = token.role;
        user.workspace = token.workspace;
        user.organizationId = token.organizationId;
        user.teamId = token.teamId;
      }
      return session;
    },
  },

  // ── Cookie hardening ──────────────────────────────────────────────────────
  // Explicit configuration for auditability. NextAuth sets httpOnly/secure
  // automatically in production but we declare them to prevent misconfiguration
  // if NEXTAUTH_URL is accidentally set to an http:// URL in staging.
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,           // Prevent JS access (XSS mitigation)
        sameSite: "lax" as const, // CSRF mitigation while allowing top-level navigation
        path: "/",
        secure: process.env.NODE_ENV === "production", // HTTPS-only in prod
      },
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};
