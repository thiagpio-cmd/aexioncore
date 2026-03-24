import { describe, it, expect } from "vitest";
import { canPerform, buildScopeFilter, actorFromSession } from "@/lib/authorization";
import type { Actor } from "@/lib/authorization";

const sdr: Actor = { id: "sdr-1", role: "SDR", organizationId: "org-1", teamId: "team-1" };
const closer: Actor = { id: "closer-1", role: "CLOSER", organizationId: "org-1", teamId: "team-1" };
const manager: Actor = { id: "mgr-1", role: "MANAGER", organizationId: "org-1", teamId: "team-1" };
const admin: Actor = { id: "admin-1", role: "ADMIN", organizationId: "org-1", teamId: "team-1" };

describe("canPerform", () => {
  describe("Lead permissions", () => {
    it("SDR can view own leads", () => {
      expect(canPerform(sdr, "lead", "view", { ownerId: sdr.id, organizationId: "org-1" })).toBe(true);
    });

    it("SDR cannot view another SDR's leads", () => {
      expect(canPerform(sdr, "lead", "view", { ownerId: "other-sdr", organizationId: "org-1" })).toBe(false);
    });

    it("Manager can view team leads", () => {
      expect(canPerform(manager, "lead", "view", { ownerId: "sdr-1", teamId: "team-1", organizationId: "org-1" })).toBe(true);
    });

    it("SDR can create own leads", () => {
      // SDR create requires scope "own" — must pass ownerId matching actor
      expect(canPerform(sdr, "lead", "create", { ownerId: sdr.id, organizationId: "org-1" })).toBe(true);
    });

    it("SDR cannot delete leads", () => {
      expect(canPerform(sdr, "lead", "delete", { ownerId: sdr.id, organizationId: "org-1" })).toBe(false);
    });

    it("Manager can delete own leads", () => {
      expect(canPerform(manager, "lead", "delete", { ownerId: manager.id, organizationId: "org-1" })).toBe(true);
    });

    it("Admin can delete any lead in org", () => {
      expect(canPerform(admin, "lead", "delete", { ownerId: "anyone", organizationId: "org-1" })).toBe(true);
    });
  });

  describe("Cross-org isolation", () => {
    it("rejects access to different organization", () => {
      expect(canPerform(admin, "lead", "view", { ownerId: admin.id, organizationId: "other-org" })).toBe(false);
    });
  });

  describe("Integration permissions", () => {
    it("SDR cannot manage integrations", () => {
      expect(canPerform(sdr, "integration", "connect", { organizationId: "org-1" })).toBe(false);
    });

    it("Admin can connect integrations", () => {
      expect(canPerform(admin, "integration", "connect", { organizationId: "org-1" })).toBe(true);
    });
  });

  describe("Audit log permissions", () => {
    it("SDR cannot view audit logs", () => {
      expect(canPerform(sdr, "audit_log", "view", { organizationId: "org-1" })).toBe(false);
    });

    it("Manager can view audit logs", () => {
      expect(canPerform(manager, "audit_log", "view", { organizationId: "org-1" })).toBe(true);
    });
  });
});

describe("buildScopeFilter", () => {
  it("returns own scope filter for SDR", () => {
    const filter = buildScopeFilter(sdr, "lead");
    expect(filter).toBeDefined();
    expect(filter.ownerId).toBe("sdr-1");
  });

  it("returns team scope filter for Manager", () => {
    const filter = buildScopeFilter(manager, "lead");
    expect(filter).toBeDefined();
    // Manager gets team OR own filter
    expect(filter.OR || filter.ownerId).toBeDefined();
  });

  it("returns empty filter for Admin (org-wide access)", () => {
    const filter = buildScopeFilter(admin, "lead");
    expect(filter).toBeDefined();
    // Admin gets no additional restrictions
    expect(filter.ownerId).toBeUndefined();
  });
});

describe("actorFromSession", () => {
  it("extracts actor from valid session", () => {
    const actor = actorFromSession({
      user: { id: "u-1", role: "SDR", organizationId: "org-1", teamId: "t-1" },
    } as any);
    expect(actor).toBeDefined();
    expect(actor!.id).toBe("u-1");
    expect(actor!.role).toBe("SDR");
  });

  it("returns null for invalid session", () => {
    expect(actorFromSession(null as any)).toBeNull();
    expect(actorFromSession({} as any)).toBeNull();
  });
});
