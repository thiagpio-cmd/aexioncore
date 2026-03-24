"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { type User, UserRole, WorkspaceType } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  workspace: WorkspaceType;
  setWorkspace: (ws: WorkspaceType) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WORKSPACE_KEY = "aexion_workspace";
const WORKSPACE_USER_KEY = "aexion_workspace_user";

function roleToDefaultWorkspace(role: string): WorkspaceType {
  switch (role) {
    case "SDR":
      return WorkspaceType.SDR;
    case "CLOSER":
      return WorkspaceType.CLOSER;
    case "MANAGER":
      return WorkspaceType.MANAGER;
    case "DIRECTOR":
    case "ADMIN":
    case "REVOPS":
    case "VIEWER":
      return WorkspaceType.EXECUTIVE;
    default:
      return WorkspaceType.SDR;
  }
}

function roleStringToEnum(role: string): UserRole {
  const mapping: Record<string, UserRole> = {
    SDR: UserRole.SDR,
    CLOSER: UserRole.CLOSER,
    MANAGER: UserRole.MANAGER,
    DIRECTOR: UserRole.DIRECTOR,
    ADMIN: UserRole.ADMIN,
    REVOPS: UserRole.REVOPS,
    VIEWER: UserRole.VIEWER,
  };
  return mapping[role] || UserRole.SDR;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [workspace, setWorkspaceState] = useState<WorkspaceType>(
    WorkspaceType.SDR
  );
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  const isLoading = status === "loading";

  // Derive user from NextAuth session
  const user: User | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name || "",
        email: session.user.email || "",
        role: roleStringToEnum(session.user.role),
        teamId: session.user.teamId || "",
        organizationId: session.user.organizationId || "",
      }
    : null;

  // Restore workspace from localStorage and set default based on role
  useEffect(() => {
    if (session?.user) {
      const currentUserId = session.user.id;
      let storedUserId: string | null = null;
      try {
        storedUserId = localStorage.getItem(WORKSPACE_USER_KEY);
      } catch {}

      if (currentUserId !== lastUserId || currentUserId !== storedUserId) {
        // New user session — use role default
        const defaultWs = roleToDefaultWorkspace(session.user.role);
        setWorkspaceState(defaultWs);
        setLastUserId(currentUserId);
        try {
          localStorage.setItem(WORKSPACE_KEY, defaultWs);
          localStorage.setItem(WORKSPACE_USER_KEY, currentUserId);
        } catch {}
      } else {
        // Same user — try localStorage
        try {
          const stored = localStorage.getItem(WORKSPACE_KEY);
          if (stored && Object.values(WorkspaceType).includes(stored as WorkspaceType)) {
            setWorkspaceState(stored as WorkspaceType);
          }
        } catch {}
      }
    }
  }, [session?.user]);

  const setWorkspace = useCallback((ws: WorkspaceType) => {
    setWorkspaceState(ws);
    try {
      localStorage.setItem(WORKSPACE_KEY, ws);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        return false;
      }

      return true;
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(WORKSPACE_KEY);
    localStorage.removeItem(WORKSPACE_USER_KEY);
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, workspace, setWorkspace, login, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
