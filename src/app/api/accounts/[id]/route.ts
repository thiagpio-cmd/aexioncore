import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import {
  sendSuccess,
  sendError,
  sendUnhandledError,
} from "@/lib/api-response";
import {
  unauthorized,
  notFound,
  forbidden,
  validationError,
} from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { AccountUpdateSchema } from "@/lib/validations/account";
import { auditUpdate } from "@/server/audit";
import { actorFromSession, canPerform } from "@/lib/authorization";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return sendError(unauthorized());
    }

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        company: true,
        opportunities: {
          include: {
            owner: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!account) {
      return sendError(notFound("Account"));
    }
    
    if (!canPerform(actor, "account", "view", { ownerId: account.ownerId ?? undefined, organizationId: account.organizationId ?? undefined })) {
      return sendError(forbidden("No access to this account"));
    }

    return sendSuccess(account);
  } catch (error: any) {
    console.error("GET /api/accounts/[id] error:", error);
    return sendUnhandledError();
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return sendError(unauthorized());
    }

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const { id } = await ctx.params;

    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      return sendError(notFound("Account"));
    }
    
    if (!canPerform(actor, "account", "edit", { ownerId: account.ownerId ?? undefined, organizationId: account.organizationId ?? undefined })) {
      return sendError(forbidden("You don't have permission to edit this account"));
    }

    const body = await request.json();
    const data = AccountUpdateSchema.parse(body);

    const updatedAccount = await prisma.account.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true } },
        opportunities: { select: { id: true, title: true, value: true, stage: true } },
      },
    });

    auditUpdate(session.user.organizationId, session.user.id, "Account", id, account as any, updatedAccount as any);
    return sendSuccess(updatedAccount);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return sendError(validationError("Invalid account data", error.errors));
    }
    console.error("PUT /api/accounts/[id] error:", error);
    return sendUnhandledError();
  }
}
