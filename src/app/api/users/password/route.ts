import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return sendError(badRequest("Current password and new password are required"));
    }

    if (newPassword.length < 8) {
      return sendError(badRequest("New password must be at least 8 characters"));
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return sendError(unauthorized("User not found"));
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return sendError(badRequest("Current password is incorrect"));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return sendSuccess({ message: "Password updated successfully" });
  } catch (error: any) {
    console.error("POST /api/users/password error:", error);
    return sendUnhandledError();
  }
}
