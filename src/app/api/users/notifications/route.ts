import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/users/notifications
 * Return current user's notification preferences (JSON string).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefs: true },
    });

    return sendSuccess({ notificationPrefs: user?.notificationPrefs ?? null });
  } catch (error: any) {
    console.error("GET /api/users/notifications error:", error);
    return sendError({ name: "InternalServerError", statusCode: 500, code: "INTERNAL_ERROR", message: error.message });
  }
}

/**
 * PATCH /api/users/notifications
 * Update current user's notification preferences.
 * Expects { notificationPrefs: Record<string, { email: boolean; push: boolean }> }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const body = await request.json();

    if (body.notificationPrefs === undefined) {
      return sendError(badRequest("notificationPrefs is required"));
    }

    const prefsString = typeof body.notificationPrefs === "string"
      ? body.notificationPrefs
      : JSON.stringify(body.notificationPrefs);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { notificationPrefs: prefsString },
    });

    return sendSuccess({ notificationPrefs: prefsString });
  } catch (error: any) {
    console.error("PATCH /api/users/notifications error:", error);
    return sendError({ name: "InternalServerError", statusCode: 500, code: "INTERNAL_ERROR", message: error.message });
  }
}
