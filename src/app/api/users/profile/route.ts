import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return sendError(badRequest("Name is required"));
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        workspace: true,
        image: true,
      },
    });

    return sendSuccess(updatedUser);
  } catch (error: any) {
    console.error("PATCH /api/users/profile error:", error);
    return sendUnhandledError();
  }
}
