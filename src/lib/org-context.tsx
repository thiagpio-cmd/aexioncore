"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";

export interface OrgConfig {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  favicon: string | null;
  enabledModules: string[];
  setupCompleted: boolean;
  setupStep: number;
  industry: string | null;
  defaultCurrency: string;
  fiscalYearStart: number;
  timezone: string;
}

const DEFAULT_CONFIG: OrgConfig = {
  id: "",
  name: "",
  slug: "",
  displayName: null,
  logoUrl: null,
  primaryColor: "#2457FF",
  secondaryColor: "#1a1a2e",
  favicon: null,
  enabledModules: ["commercial", "data", "reports", "automation", "post_sale", "playbooks"],
  setupCompleted: false,
  setupStep: 0,
  industry: null,
  defaultCurrency: "BRL",
  fiscalYearStart: 1,
  timezone: "America/Sao_Paulo",
};

interface OrgContextValue {
  org: OrgConfig;
  isLoading: boolean;
  isModuleEnabled: (moduleKey: string) => boolean;
  refresh: () => void;
}

const OrgContext = createContext<OrgContextValue>({
  org: DEFAULT_CONFIG,
  isLoading: true,
  isModuleEnabled: () => true,
  refresh: () => {},
});

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [org, setOrg] = useState<OrgConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch("/api/organization");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setOrg({
            ...DEFAULT_CONFIG,
            ...data.data,
            primaryColor: data.data.primaryColor || DEFAULT_CONFIG.primaryColor,
            secondaryColor: data.data.secondaryColor || DEFAULT_CONFIG.secondaryColor,
            defaultCurrency: data.data.defaultCurrency || DEFAULT_CONFIG.defaultCurrency,
            timezone: data.data.timezone || DEFAULT_CONFIG.timezone,
            enabledModules: data.data.enabledModules || DEFAULT_CONFIG.enabledModules,
          });
        }
      }
    } catch {
      // Use defaults on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchOrg();
    } else {
      setIsLoading(false);
    }
  }, [session, fetchOrg]);

  const isModuleEnabled = useCallback(
    (moduleKey: string) => org.enabledModules.includes(moduleKey),
    [org.enabledModules]
  );

  return (
    <OrgContext.Provider value={{ org, isLoading, isModuleEnabled, refresh: fetchOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
