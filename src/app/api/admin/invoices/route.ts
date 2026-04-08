import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

/**
 * GET /api/admin/invoices — List invoices (global or per org)
 */
export async function GET(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("organizationId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const where: any = {};
  if (orgId) where.organizationId = orgId;
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        subscription: {
          select: {
            id: true,
            plan: { select: { name: true, tier: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return sendSuccess(invoices, 200, { page, limit, total });
}

/**
 * POST /api/admin/invoices — Create a manual invoice
 */
export async function POST(request: NextRequest) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      organizationId,
      subscriptionId,
      amountDue,
      currency,
      dueDate,
      lineItems,
      notes,
    } = body;

    if (!organizationId || !amountDue) {
      return sendError(badRequest("organizationId and amountDue are required"));
    }

    // Generate invoice number: INV-YYYYMM-XXXX
    const now = new Date();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const count = await prisma.invoice.count({
      where: { invoiceNumber: { startsWith: prefix } },
    });
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        subscriptionId: subscriptionId || null,
        invoiceNumber,
        status: "OPEN",
        amountDue,
        currency: currency || "USD",
        dueDate: dueDate ? new Date(dueDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        lineItems: lineItems ? JSON.stringify(lineItems) : null,
        notes: notes || null,
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    await logAdminAction({
      action: "CREATE_INVOICE",
      targetType: "invoice",
      targetId: invoice.id,
      details: { invoiceNumber, amountDue, orgId: organizationId },
    });

    return sendSuccess(invoice, 201);
  } catch (error: any) {
    console.error("POST /api/admin/invoices error:", error);
    return sendError(badRequest("Failed to create invoice"));
  }
}
