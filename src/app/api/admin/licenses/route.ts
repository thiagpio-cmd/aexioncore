import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import crypto from "crypto";

function generateLicenseKey(): string {
  const segment = () =>
    crypto
      .randomBytes(2)
      .toString("hex")
      .toUpperCase();
  return `AXN-${segment()}-${segment()}-${segment()}`;
}

/**
 * GET /api/admin/licenses — List all license keys
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: any = {};
  if (status) where.status = status;

  const licenses = await prisma.licenseKey.findMany({
    where,
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(licenses);
}

/**
 * POST /api/admin/licenses — Generate a new license key
 */
export async function POST(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      organizationId,
      planTier,
      features,
      maxActivations,
      expiresAt,
      notes,
      count,
    } = body;

    const batchCount = Math.min(count || 1, 50); // max 50 at a time
    const licenses = [];

    for (let i = 0; i < batchCount; i++) {
      // Ensure unique key
      let key: string;
      let attempts = 0;
      do {
        key = generateLicenseKey();
        attempts++;
      } while (
        attempts < 10 &&
        (await prisma.licenseKey.findUnique({ where: { key } }))
      );

      const license = await prisma.licenseKey.create({
        data: {
          key,
          organizationId: organizationId || null,
          planTier: planTier || null,
          features: features ? JSON.stringify(features) : null,
          maxActivations: maxActivations || 1,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          notes: notes || null,
          createdBy: "admin",
        },
      });

      licenses.push(license);
    }

    await logAdminAction({
      action: "GENERATE_LICENSE",
      targetType: "license_key",
      targetId: licenses[0]?.id,
      details: {
        count: batchCount,
        planTier,
        keys: licenses.map((l) => l.key),
      },
    });

    return sendSuccess(licenses, 201);
  } catch (error: any) {
    console.error("POST /api/admin/licenses error:", error);
    return sendError(badRequest("Failed to generate license key"));
  }
}
