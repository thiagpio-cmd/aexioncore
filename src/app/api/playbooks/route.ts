/**
 * GET /api/playbooks   — list playbooks for the current organization
 * POST /api/playbooks  — create a new playbook (MANAGER+ only)
 *
 * Security:
 * - Session required on both methods.
 * - GET: all authenticated users can view playbooks (they are org-level config).
 *   Scoped to the session's organizationId — never to a caller-supplied ID.
 * - POST: requires MANAGER role or higher (playbooks are org configuration).
 *   Input is validated with Zod before hitting the database.
 *   An audit log entry is written on successful creation.
 * - Error messages are generic — internal details are never surfaced to clients.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized, validationError } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/server/auth";
import { PlaybookCreateSchema } from "@/lib/validations/playbook";
import { auditCreate } from "@/server/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const playbooks = await prisma.playbook.findMany({
      // SECURITY: organizationId always sourced from the session JWT, never from
      // request params. This prevents cross-tenant data access.
      where: { organizationId: session.user.organizationId },
      include: {
        steps: { orderBy: { order: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    return sendSuccess(playbooks);
  } catch (error: unknown) {
    console.error("GET /api/playbooks error:", error);
    return sendUnhandledError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    // ── RBAC: MANAGER+ only ───────────────────────────────────────────────
    const roleError = requireRole(session.user as any, "MANAGER");
    if (roleError) return roleError;

    const body = await request.json();

    // ── Zod validation ────────────────────────────────────────────────────
    // Validates all fields including nested steps. Prevents injection via
    // unvalidated free-text fields.
    const parsed = PlaybookCreateSchema.safeParse(body);
    if (!parsed.success) {
      return sendError(validationError("Dados do playbook inválidos", parsed.error.issues));
    }

    const { name, description, segment, stage, steps } = parsed.data;

    const playbook = await prisma.playbook.create({
      data: {
        organizationId: session.user.organizationId,
        name: name.trim(),
        description: description ?? null,
        segment: segment ?? null,
        stage: stage ?? null,
        steps:
          steps && steps.length > 0
            ? {
                create: steps.map((s, i) => ({
                  order: i + 1,
                  title: s.title,
                  description: s.description ?? null,
                  resources: s.resources ?? null,
                })),
              }
            : undefined,
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    // ── Audit log ─────────────────────────────────────────────────────────
    // Records who created the playbook and its name for compliance.
    auditCreate(
      session.user.organizationId,
      session.user.id,
      "Playbook",
      playbook.id,
      { name: playbook.name, stepCount: playbook.steps.length }
    );

    return sendSuccess(playbook, 201);
  } catch (error: unknown) {
    if ((error as any)?.name === "ZodError") {
      return sendError(validationError("Dados inválidos", (error as any).errors));
    }
    console.error("POST /api/playbooks error:", error);
    return sendUnhandledError();
  }
}
