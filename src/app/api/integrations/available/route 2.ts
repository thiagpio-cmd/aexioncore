import { getServerSession } from "next-auth";
import { sendSuccess, sendError, sendUnhandledError } from "@/lib/api-response";
import { unauthorized } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { providerRegistry } from "@/lib/integrations/provider-registry";
import { ensureProvidersInitialized } from "@/lib/integrations/init";

/**
 * GET /api/integrations/available
 *
 * Returns which integration providers are registered and whether each one
 * is configured (i.e. the required env vars are present on the server).
 * The client uses this to decide button states (Connect vs Setup Required).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    ensureProvidersInitialized();

    const metadataList = providerRegistry.list();

    const providers = metadataList.map((meta) => {
      const instance = providerRegistry.get(meta.key);
      return {
        key: meta.key,
        name: meta.name,
        configured: instance ? instance.isConfigured() : false,
        type: meta.authType,
        domain: meta.domain,
      };
    });

    return sendSuccess({ providers });
  } catch (error: any) {
    console.error("GET /api/integrations/available error:", error);
    return sendUnhandledError();
  }
}
