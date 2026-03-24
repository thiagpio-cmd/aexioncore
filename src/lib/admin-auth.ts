/**
 * Admin Authentication
 *
 * Protects admin-only endpoints with a shared secret.
 * Completely independent from NextAuth/tenant sessions.
 */

import { NextRequest } from "next/server";
import { sendError } from "./api-response";
import { unauthorized } from "./errors";
import crypto from "crypto";

/**
 * Validates the admin secret from the Authorization header.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @returns null if valid, Response if invalid
 */
export function requireAdminSecret(request: NextRequest): Response | null {
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    console.error("ADMIN_SECRET not configured in environment");
    return sendError(unauthorized("Admin panel not configured"));
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(unauthorized("Admin secret required"));
  }

  const provided = authHeader.slice(7); // Remove "Bearer "

  // Timing-safe comparison
  try {
    const secretBuf = Buffer.from(secret, "utf-8");
    const providedBuf = Buffer.from(provided, "utf-8");

    if (secretBuf.length !== providedBuf.length) {
      return sendError(unauthorized("Invalid admin secret"));
    }

    if (!crypto.timingSafeEqual(secretBuf, providedBuf)) {
      return sendError(unauthorized("Invalid admin secret"));
    }
  } catch {
    return sendError(unauthorized("Invalid admin secret"));
  }

  return null; // Valid
}
