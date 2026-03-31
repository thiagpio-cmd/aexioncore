import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, badRequest, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { PasswordChangeSchema } from "@/lib/validations/user";
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // Rate limit: prevent brute-force guessing of current password
    const rateKey = `password-change:${session.user.id}`;
    const rateCheck = checkRateLimit(rateKey, RATE_LIMITS.login);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck);

    const body = await request.json();
    const parsed = PasswordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return sendError(validationError("Invalid password data", parsed.error.issues));
    }
    const { currentPassword, newPassword } = parsed.data;

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
