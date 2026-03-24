"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/shared/toast";
import { OrgProvider } from "@/lib/org-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <OrgProvider>
        <ToastProvider>{children}</ToastProvider>
      </OrgProvider>
    </SessionProvider>
  );
}
