import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, forbidden, badRequest, conflictError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";

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

    if (!body.name?.trim()) return sendError(badRequest("Name is required"));
    if (!body.email?.trim()) return sendError(badRequest("Email is required"));
    if (!body.role?.trim()) return sendError(badRequest("Role is required"));

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    });
    if (existing) {
      return sendError(conflictError("A user with this email already exists"));
    }

    // Generate a temporary password — user can change it on first login
    const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        password: hashedPassword,
        role: body.role,
        workspace: body.workspace || "SDR",
        organizationId: session.user.organizationId,
        teamId: body.teamId || null,
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
    console.error("POST /api/users error:", error);
    return sendUnhandledError();
  }
}
