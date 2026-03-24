import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { createInboxAction } from "@/lib/domain/inbox/inbox-action-service";
import { z } from "zod";

const CreateActionSchema = z.object({
  actionType: z.string().default("FOLLOW_UP"),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) return sendError(unauthorized());

    const { id } = await ctx.params;
    const body = await request.json();
    const data = CreateActionSchema.parse(body);

    const task = await createInboxAction(
      id,
      session.user.organizationId,
      session.user.id,
      data
    );

    return sendSuccess({ task }, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(badRequest("Invalid action data"));
    if (error.message?.includes("Message not found")) return sendError(badRequest(error.message));
    
    console.error("POST /api/inbox/[id]/create-action error:", error);
    return sendUnhandledError();
  }
}
