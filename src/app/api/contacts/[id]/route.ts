import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, notFound, forbidden, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { ContactUpdateSchema } from "@/lib/validations/contact";
import { auditUpdate } from "@/server/audit";
import { actorFromSession, canPerform } from "@/lib/authorization";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        company: true,
        leads: { select: { id: true, name: true, status: true } },
        meetings: { select: { id: true, title: true, startTime: true } },
      },
    });

    if (!contact) return sendError(notFound("Contact"));
    if (!canPerform(actor, "contact", "view", { organizationId: contact.organizationId ?? undefined })) return sendError(forbidden("No access"));
    return sendSuccess(contact);
  } catch (error: any) {
    console.error("GET /api/contacts/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) return sendError(notFound("Contact"));
    if (!canPerform(actor, "contact", "edit", { organizationId: contact.organizationId ?? undefined })) return sendError(forbidden("No access"));

    const body = await request.json();
    const data = ContactUpdateSchema.parse(body);

    const updated = await prisma.contact.update({
      where: { id },
      data,
      include: { company: { select: { id: true, name: true } } },
    });

    auditUpdate(session.user.organizationId, session.user.id, "Contact", id, contact as any, updated as any);
    return sendSuccess(updated);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid data", error.errors));
    console.error("PUT /api/contacts/[id] error:", error);
    return sendUnhandledError();
  }
}
