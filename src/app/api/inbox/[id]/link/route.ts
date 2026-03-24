import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { linkInboxMessage } from "@/lib/domain/inbox/inbox-action-service";
import { z } from "zod";

const LinkSchema = z.object({
  entityType: z.enum(["lead", "opportunity"]),
  entityId: z.string().min(1),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) return sendError(unauthorized());

    const { id } = await ctx.params;
    const body = await request.json();
    const data = LinkSchema.parse(body);

    const updated = await linkInboxMessage(
      id,
      session.user.organizationId,
      session.user.id,
      data
    );

    return sendSuccess({ message: updated });
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(badRequest("Invalid link data"));
    if (error.message?.includes("Message not found")) return sendError(badRequest(error.message));
    
    console.error("POST /api/inbox/[id]/link error:", error);
    return sendUnhandledError();
  }
}
