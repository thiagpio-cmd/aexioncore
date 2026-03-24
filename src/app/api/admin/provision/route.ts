import { NextRequest } from "next/server";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError } from "@/lib/api-response";
import { badRequest } from "@/lib/errors";
import { requireAdminSecret } from "@/lib/admin-auth";

/**
 * POST /api/admin/provision
 *
 * Provisions a complete new tenant: organization, teams, users, pipeline, stages.
 * Protected by ADMIN_SECRET — no NextAuth dependency.
 */
export async function POST(request: NextRequest) {
  // Auth check
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // ─── Validate Required Fields ──────────────────────────────────────────
    const { company, adminUser, teamMembers, pipeline, modules, branding, gmail } = body;

    if (!company?.name || !company?.slug) {
      return sendError(badRequest("company.name and company.slug are required"));
    }
    if (!adminUser?.name || !adminUser?.email || !adminUser?.password) {
      return sendError(badRequest("adminUser.name, email, and password are required"));
    }
    if (adminUser.password.length < 6) {
      return sendError(badRequest("Password must be at least 6 characters"));
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(company.slug)) {
      return sendError(badRequest("Slug must be lowercase alphanumeric with hyphens only"));
    }

    // ─── Idempotency Check ─────────────────────────────────────────────────
    const existing = await prisma.organization.findUnique({
      where: { slug: company.slug },
    });
    if (existing) {
      return sendError(badRequest(`Organization with slug "${company.slug}" already exists`));
    }

    // Check admin email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: adminUser.email },
    });
    if (existingUser) {
      return sendError(badRequest(`User with email "${adminUser.email}" already exists`));
    }

    // ─── Provision in Transaction ──────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: company.name,
          slug: company.slug,
          displayName: company.name,
          industry: company.industry || "Other",
          defaultCurrency: company.defaultCurrency || "USD",
          timezone: company.timezone || "America/New_York",
          primaryColor: branding?.primaryColor || "#2457FF",
          secondaryColor: branding?.secondaryColor || "#1a1a2e",
          logoUrl: branding?.logoUrl || null,
          setupCompleted: true,
          setupStep: 5,
          enabledModules: JSON.stringify(
            modules || ["commercial", "data", "reports", "automation", "post_sale", "playbooks"]
          ),
        },
      });

      // 2. Create 4 Default Teams
      const sdrTeam = await tx.team.create({
        data: { organizationId: org.id, name: "SDR Team", description: "Lead prospecting and qualification" },
      });
      const closerTeam = await tx.team.create({
        data: { organizationId: org.id, name: "Closers", description: "Deal negotiation and closing" },
      });
      const mgrTeam = await tx.team.create({
        data: { organizationId: org.id, name: "Management", description: "Team and operations management" },
      });
      const execTeam = await tx.team.create({
        data: { organizationId: org.id, name: "Executive", description: "Executive leadership" },
      });

      const teamMap: Record<string, string> = {
        SDR: sdrTeam.id,
        CLOSER: closerTeam.id,
        MANAGER: mgrTeam.id,
        DIRECTOR: mgrTeam.id,
        REVOPS: mgrTeam.id,
        ADMIN: execTeam.id,
        VIEWER: execTeam.id,
        USER: sdrTeam.id,
      };

      // 3. Create Admin User
      const adminPwHash = await bcrypt.hash(adminUser.password, 10);
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          teamId: execTeam.id,
          email: adminUser.email,
          name: adminUser.name,
          password: adminPwHash,
          role: "ADMIN",
          workspace: "EXECUTIVE",
          isActive: true,
        },
      });

      // Set team manager
      await tx.team.update({
        where: { id: execTeam.id },
        data: { managerId: admin.id },
      });

      // 4. Create Additional Team Members
      const credentials: Array<{ name: string; email: string; password: string; role: string }> = [
        { name: adminUser.name, email: adminUser.email, password: adminUser.password, role: "ADMIN" },
      ];

      if (teamMembers && Array.isArray(teamMembers)) {
        for (const member of teamMembers) {
          if (!member.email || !member.name) continue;

          // Check email uniqueness
          const existingMember = await tx.user.findUnique({ where: { email: member.email } });
          if (existingMember) continue; // Skip duplicates

          const memberPw = member.password || generatePassword();
          const memberPwHash = await bcrypt.hash(memberPw, 10);
          const role = member.role || "SDR";
          const workspace = mapRoleToWorkspace(role);

          await tx.user.create({
            data: {
              organizationId: org.id,
              teamId: teamMap[role] || sdrTeam.id,
              email: member.email,
              name: member.name,
              password: memberPwHash,
              role,
              workspace,
              isActive: true,
            },
          });

          credentials.push({ name: member.name, email: member.email, password: memberPw, role });
        }
      }

      // 5. Create Pipeline + Stages
      const pipelineName = pipeline?.name || "Sales Pipeline";
      const defaultStages = [
        { name: "Discovery", order: 1, color: "#3B82F6", probability: 10 },
        { name: "Qualification", order: 2, color: "#8B5CF6", probability: 25 },
        { name: "Proposal", order: 3, color: "#F59E0B", probability: 50 },
        { name: "Negotiation", order: 4, color: "#EF4444", probability: 75 },
        { name: "Closed Won", order: 5, color: "#10B981", probability: 100 },
        { name: "Closed Lost", order: 6, color: "#6B7280", probability: 0 },
      ];

      const stages = pipeline?.stages || defaultStages;

      const pipe = await tx.pipeline.create({
        data: {
          organizationId: org.id,
          name: pipelineName,
        },
      });

      const createdStages = [];
      for (const stage of stages) {
        const s = await tx.stage.create({
          data: {
            pipelineId: pipe.id,
            name: stage.name,
            order: stage.order,
            color: stage.color || "#3B82F6",
          },
        });
        createdStages.push(s);
      }

      // 6. Create Gmail Integration (if provided)
      if (gmail?.clientId && gmail?.clientSecret) {
        await tx.integration.create({
          data: {
            organizationId: org.id,
            providerKey: "gmail",
            name: "Gmail",
            slug: `gmail-${org.slug}`,
            status: "DISCONNECTED",
            authType: "oauth2",
            scopes: JSON.stringify(["https://www.googleapis.com/auth/gmail.readonly"]),
          },
        });
      }

      // 7. Create Audit Log Entry
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          userId: admin.id,
          action: "CREATE",
          objectType: "Organization",
          objectId: org.id,
          details: JSON.stringify({
            event: "tenant_provisioned",
            company: company.name,
            slug: company.slug,
            userCount: credentials.length,
            modules: modules || ["commercial", "data", "reports", "automation", "post_sale", "playbooks"],
          }),
        },
      });

      return {
        organization: { id: org.id, name: org.name, slug: org.slug },
        credentials,
        teams: [
          { id: sdrTeam.id, name: "SDR Team" },
          { id: closerTeam.id, name: "Closers" },
          { id: mgrTeam.id, name: "Management" },
          { id: execTeam.id, name: "Executive" },
        ],
        pipeline: { id: pipe.id, name: pipelineName, stageCount: createdStages.length },
        loginUrl: "/login",
      };
    });

    return sendSuccess(result, 201);
  } catch (error: any) {
    console.error("POST /api/admin/provision error:", error);
    return sendError(badRequest(error.message || "Provisioning failed"));
  }
}

function mapRoleToWorkspace(role: string): string {
  const map: Record<string, string> = {
    SDR: "SDR",
    CLOSER: "CLOSER",
    MANAGER: "MANAGER",
    DIRECTOR: "MANAGER",
    REVOPS: "MANAGER",
    ADMIN: "EXECUTIVE",
    VIEWER: "EXECUTIVE",
    USER: "SDR",
  };
  return map[role] || "SDR";
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}
