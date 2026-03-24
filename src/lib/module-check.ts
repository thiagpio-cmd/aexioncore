import { prisma } from "@/lib/db";

/**
 * Server-side module enforcement.
 *
 * Checks whether a specific module is enabled for the given organization.
 * API routes can call this to reject requests for disabled modules early.
 *
 * Defaults to `true` (all modules enabled) when:
 * - The organization has no `enabledModules` value set
 * - The stored value is not valid JSON
 */
export async function isModuleEnabledForOrg(
  organizationId: string,
  moduleKey: string
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { enabledModules: true },
  });

  if (!org?.enabledModules) return true; // default: all enabled

  try {
    const modules: string[] = JSON.parse(org.enabledModules);
    return modules.includes(moduleKey);
  } catch {
    return true;
  }
}
