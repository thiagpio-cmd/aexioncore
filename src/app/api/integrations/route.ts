import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { buildScopeFilter, actorFromSession } from "@/lib/authorization";
import { providerRegistry } from "@/lib/integrations/provider-registry";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const actor = actorFromSession(session);
    if (!actor) return sendError(unauthorized());

    const scopeFilter = buildScopeFilter(actor, "integration");

    // Get strictly authorized integrations from DB for this tenant
    const dbIntegrations = await prisma.integration.findMany({
      where: { 
        organizationId: session.user.organizationId,
        ...scopeFilter
      },
    });

    const dbMap = new Map();
    for (const int of dbIntegrations) {
      if (int.providerKey) {
        dbMap.set(int.providerKey, int);
      } else {
        // Fallback for older seeded records using slug
        dbMap.set(int.slug, int);
      }
    }

    // Merge registered providers with DB state
    const providers = providerRegistry.list();
    
    // Some dbIntegrations might not exist in registry (legacy or custom), we want to preserve them too.
    const resultMap = new Map<string, any>();
    
    for (const p of providers) {
      const providerInstance = providerRegistry.get(p.key);
      const isConfigured = providerInstance ? providerInstance.isConfigured() : false;

      const existing = dbMap.get(p.key);
      if (existing && existing.status !== "DISCONNECTED") {
        resultMap.set(existing.id, {
          ...existing,
          isConfigured,
        });
      } else {
        // Virtual DISCONNECTED record
        resultMap.set(`virtual-${p.key}`, {
          id: `virtual-${p.key}`,
          providerKey: p.key,
          slug: p.key,
          name: p.name,
          description: p.description,
          status: "DISCONNECTED",
          domain: p.domain,
          healthPercent: 0,
          isConfigured,
        });
      }
    }

    // Add any DB integrations that were active but not in registry (should be rare/impossible in v2)
    for (const int of dbIntegrations) {
      if (!resultMap.has(int.id) && int.status !== "DISCONNECTED") {
         resultMap.set(int.id, int);
      }
    }

    const merged = Array.from(resultMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return sendSuccess(merged);

  } catch (error: any) {
    console.error("GET /api/integrations error:", error);
    return sendUnhandledError();
  }
}

