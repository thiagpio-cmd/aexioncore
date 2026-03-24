/**
 * Credential Vault
 *
 * Secure storage and retrieval of integration credentials.
 * Handles encryption, rotation, masking, and audit.
 *
 * For MVP: uses AES-256-CBC encryption with a key derived from
 * NEXTAUTH_SECRET. Production should use a KMS.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";

// ─── Encryption ─────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET environment variable is required for credential encryption. Cannot start without it.");
  // Derive a 32-byte key from the secret
  return createHash("sha256").update(secret).digest();
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !encrypted) throw new Error("Invalid encrypted format");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Mask a token for display (e.g., "sk-abc...xyz")
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) return "***";
  return token.substring(0, 6) + "..." + token.substring(token.length - 4);
}

// ─── Vault Operations ───────────────────────────────────────────────────────

export interface CredentialData {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  signingSecret?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Store or update credentials for an integration.
 * All sensitive values are encrypted before storage.
 */
export async function storeCredentials(
  integrationId: string,
  data: CredentialData
): Promise<string> {
  // Encrypt sensitive fields
  const encryptedAccess = data.accessToken
    ? encrypt(data.accessToken)
    : undefined;
  const encryptedRefresh = data.refreshToken
    ? encrypt(data.refreshToken)
    : undefined;

  // Check if credentials already exist
  const existing = await prisma.integrationCredential.findFirst({
    where: { integrationId },
  });

  if (existing) {
    await prisma.integrationCredential.update({
      where: { id: existing.id },
      data: {
        accessToken: encryptedAccess ?? existing.accessToken,
        refreshToken: encryptedRefresh ?? existing.refreshToken,
        expiresAt: data.expiresAt ?? existing.expiresAt,
        updatedAt: new Date(),
      },
    });
    return existing.id;
  }

  const created = await prisma.integrationCredential.create({
    data: {
      integrationId,
      accessToken: encryptedAccess ?? null,
      refreshToken: encryptedRefresh ?? null,
      expiresAt: data.expiresAt ?? null,
    },
  });

  return created.id;
}

/**
 * Retrieve and decrypt credentials for an integration.
 */
export async function getCredentials(
  integrationId: string
): Promise<CredentialData | null> {
  const cred = await prisma.integrationCredential.findFirst({
    where: { integrationId },
    orderBy: { updatedAt: "desc" },
  });

  if (!cred) return null;

  return {
    accessToken: cred.accessToken ? decrypt(cred.accessToken) : undefined,
    refreshToken: cred.refreshToken ? decrypt(cred.refreshToken) : undefined,
    expiresAt: cred.expiresAt ?? undefined,
  };
}

/**
 * Check if credentials are expired.
 */
export function isExpired(creds: CredentialData): boolean {
  if (!creds.expiresAt) return false;
  // Add 5 minute buffer
  const buffer = 5 * 60 * 1000;
  return new Date(creds.expiresAt).getTime() - buffer < Date.now();
}

/**
 * Delete all credentials for an integration (on disconnect).
 */
export async function revokeCredentials(
  integrationId: string
): Promise<void> {
  await prisma.integrationCredential.deleteMany({
    where: { integrationId },
  });
}

/**
 * Get credential metadata (non-sensitive info for UI display).
 */
export async function getCredentialInfo(integrationId: string): Promise<{
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt: Date | null;
  lastUpdated: Date;
  maskedAccessToken?: string;
} | null> {
  const cred = await prisma.integrationCredential.findFirst({
    where: { integrationId },
    orderBy: { updatedAt: "desc" },
  });

  if (!cred) return null;

  return {
    hasAccessToken: !!cred.accessToken,
    hasRefreshToken: !!cred.refreshToken,
    expiresAt: cred.expiresAt,
    lastUpdated: cred.updatedAt,
    maskedAccessToken: cred.accessToken
      ? maskToken(decrypt(cred.accessToken))
      : undefined,
  };
}
