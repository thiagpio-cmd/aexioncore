"use client";

import { useOrg } from "@/lib/org-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Guards a page behind module activation.
 * If the module is disabled for the tenant, redirects to home.
 */
export function ModuleGuard({
  moduleKey,
  children,
}: {
  moduleKey: string;
  children: ReactNode;
}) {
  const { isModuleEnabled, isLoading } = useOrg();
  const router = useRouter();

  const enabled = isModuleEnabled(moduleKey);

  useEffect(() => {
    if (!isLoading && !enabled) {
      router.replace("/");
    }
  }, [isLoading, enabled, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        Loading...
      </div>
    );
  }

  if (!enabled) return null;

  return <>{children}</>;
}
