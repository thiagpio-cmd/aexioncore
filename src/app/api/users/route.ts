import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest, conflictError, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { UserCreateSchema } from "@/lib/validations/user";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const users = await prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        workspace: true,
        image: true,
        isActive: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return sendSuccess(users);
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const roleError = requireRole(session.user as any, "ADMIN");
    if (roleError) return roleError;

    const body = await request.json();
    const data = UserCreateSchema.parse(body);
    const email = data.email.toLowerCase();

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      return sendError(conflictError("A user with this email already exists"));
    }

    // Generate a temporary password — user can change it on first login
    const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email,
        password: hashedPassword,
        role: data.role,
        workspace: data.workspace || "SDR",
        organizationId: session.user.organizationId,
        teamId: data.teamId || null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        workspace: true,
        isActive: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    return sendSuccess(user, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return sendError(validationError("Invalid user data", error.errors));
    console.error("POST /api/users error:", error);
    return sendUnhandledError();
  }
}
