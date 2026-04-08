import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/bootstrap
 * One-time endpoint to create licensing tables + seed default plans.
 * Uses the same seed secret as /api/admin/seed.
 * DELETE THIS FILE after successful bootstrap.
 */
const SEED_SECRET = process.env.SEED_SECRET || "aexion-seed-2026";

const DEFAULT_PLANS = [
  {
    name: "Free",
    slug: "free",
    description: "For individuals exploring the platform",
    tier: "FREE",
    maxSeats: 2,
    maxDeals: 20,
    maxLeads: 50,
    maxStorageMB: 100,
    maxAICallsPerMonth: 20,
    maxIntegrations: 1,
    enabledModules: JSON.stringify(["commercial"]),
    enabledFeatures: JSON.stringify({ customBranding: false, rbacCustom: false, apiAccess: false, advancedReports: false, playbooks: false }),
    priceMonthly: 0,
    priceAnnual: 0,
    currency: "USD",
    trialDays: 0,
    isPublic: true,
    sortOrder: 0,
  },
  {
    name: "Starter",
    slug: "starter",
    description: "For small teams getting started with CRE revenue operations",
    tier: "STARTER",
    maxSeats: 5,
    maxDeals: 100,
    maxLeads: 500,
    maxStorageMB: 1024,
    maxAICallsPerMonth: 200,
    maxIntegrations: 3,
    enabledModules: JSON.stringify(["commercial", "data", "reports"]),
    enabledFeatures: JSON.stringify({ customBranding: false, rbacCustom: false, apiAccess: false, advancedReports: false, playbooks: false }),
    priceMonthly: 4900,
    priceAnnual: 47000,
    currency: "USD",
    trialDays: 14,
    isPublic: true,
    sortOrder: 1,
  },
  {
    name: "Professional",
    slug: "professional",
    description: "For growing brokerages with advanced automation needs",
    tier: "PROFESSIONAL",
    maxSeats: 25,
    maxDeals: 1000,
    maxLeads: 5000,
    maxStorageMB: 10240,
    maxAICallsPerMonth: 2000,
    maxIntegrations: 10,
    enabledModules: JSON.stringify(["commercial", "data", "reports", "automation", "playbooks"]),
    enabledFeatures: JSON.stringify({ customBranding: true, rbacCustom: true, apiAccess: true, advancedReports: true, playbooks: true }),
    priceMonthly: 14900,
    priceAnnual: 143000,
    currency: "USD",
    trialDays: 14,
    isPublic: true,
    sortOrder: 2,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "For large organizations with custom requirements and unlimited scale",
    tier: "ENTERPRISE",
    maxSeats: -1,
    maxDeals: -1,
    maxLeads: -1,
    maxStorageMB: 102400,
    maxAICallsPerMonth: -1,
    maxIntegrations: -1,
    enabledModules: JSON.stringify(["commercial", "data", "reports", "automation", "post_sale", "playbooks"]),
    enabledFeatures: JSON.stringify({ customBranding: true, rbacCustom: true, apiAccess: true, advancedReports: true, playbooks: true, sso: true, dedicatedSupport: true, customIntegrations: true }),
    priceMonthly: 0,
    priceAnnual: 0,
    currency: "USD",
    trialDays: 30,
    isPublic: true,
    sortOrder: 3,
  },
];

// Each SQL statement must be a separate call (Prisma limitation)
const SQL_STATEMENTS: Array<{ label: string; sql: string }> = [
  // -- plans table --
  { label: "plans_table", sql: `CREATE TABLE IF NOT EXISTS "plans" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT, "tier" TEXT NOT NULL DEFAULT 'STARTER', "maxSeats" INTEGER NOT NULL DEFAULT 5, "maxDeals" INTEGER NOT NULL DEFAULT 100, "maxLeads" INTEGER NOT NULL DEFAULT 500, "maxStorageMB" INTEGER NOT NULL DEFAULT 1024, "maxAICallsPerMonth" INTEGER NOT NULL DEFAULT 200, "maxIntegrations" INTEGER NOT NULL DEFAULT 3, "enabledModules" TEXT, "enabledFeatures" TEXT, "priceMonthly" INTEGER NOT NULL DEFAULT 0, "priceAnnual" INTEGER NOT NULL DEFAULT 0, "currency" TEXT NOT NULL DEFAULT 'USD', "trialDays" INTEGER NOT NULL DEFAULT 14, "isActive" BOOLEAN NOT NULL DEFAULT true, "isPublic" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0, "metadata" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "plans_pkey" PRIMARY KEY ("id"))` },
  { label: "plans_slug_idx", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_key" ON "plans"("slug")` },
  { label: "plans_tier_idx", sql: `CREATE INDEX IF NOT EXISTS "plans_tier_idx" ON "plans"("tier")` },
  { label: "plans_active_idx", sql: `CREATE INDEX IF NOT EXISTS "plans_isActive_isPublic_idx" ON "plans"("isActive", "isPublic")` },

  // -- subscriptions table --
  { label: "subscriptions_table", sql: `CREATE TABLE IF NOT EXISTS "subscriptions" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "organizationId" TEXT NOT NULL, "planId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'TRIALING', "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "currentPeriodEnd" TIMESTAMP(3) NOT NULL, "trialStart" TIMESTAMP(3), "trialEnd" TIMESTAMP(3), "canceledAt" TIMESTAMP(3), "cancelReason" TEXT, "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY', "stripeSubscriptionId" TEXT, "stripeCustomerId" TEXT, "seatOverride" INTEGER, "featureOverrides" TEXT, "metadata" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"), CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE)` },
  { label: "subs_orgId_idx", sql: `CREATE INDEX IF NOT EXISTS "subscriptions_organizationId_idx" ON "subscriptions"("organizationId")` },
  { label: "subs_planId_idx", sql: `CREATE INDEX IF NOT EXISTS "subscriptions_planId_idx" ON "subscriptions"("planId")` },
  { label: "subs_status_idx", sql: `CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status")` },
  { label: "subs_stripe_idx", sql: `CREATE INDEX IF NOT EXISTS "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId")` },

  // -- usage_records table --
  { label: "usage_records_table", sql: `CREATE TABLE IF NOT EXISTS "usage_records" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "organizationId" TEXT NOT NULL, "subscriptionId" TEXT, "metric" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 0, "limitVal" INTEGER NOT NULL DEFAULT 0, "overage" INTEGER NOT NULL DEFAULT 0, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id"), CONSTRAINT "usage_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "usage_records_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE)` },
  { label: "usage_orgMetric_idx", sql: `CREATE INDEX IF NOT EXISTS "usage_records_orgId_metric_idx" ON "usage_records"("organizationId", "metric")` },
  { label: "usage_orgPeriod_idx", sql: `CREATE INDEX IF NOT EXISTS "usage_records_orgId_periodStart_idx" ON "usage_records"("organizationId", "periodStart")` },
  { label: "usage_subId_idx", sql: `CREATE INDEX IF NOT EXISTS "usage_records_subscriptionId_idx" ON "usage_records"("subscriptionId")` },

  // -- invoices table --
  { label: "invoices_table", sql: `CREATE TABLE IF NOT EXISTS "invoices" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "organizationId" TEXT NOT NULL, "subscriptionId" TEXT, "invoiceNumber" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "amountDue" INTEGER NOT NULL DEFAULT 0, "amountPaid" INTEGER NOT NULL DEFAULT 0, "currency" TEXT NOT NULL DEFAULT 'USD', "periodStart" TIMESTAMP(3), "periodEnd" TIMESTAMP(3), "dueDate" TIMESTAMP(3), "paidAt" TIMESTAMP(3), "lineItems" TEXT, "stripeInvoiceId" TEXT, "pdfUrl" TEXT, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"), CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE)` },
  { label: "invoices_number_idx", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber")` },
  { label: "invoices_orgId_idx", sql: `CREATE INDEX IF NOT EXISTS "invoices_organizationId_idx" ON "invoices"("organizationId")` },
  { label: "invoices_subId_idx", sql: `CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId")` },
  { label: "invoices_status_idx", sql: `CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status")` },
  { label: "invoices_stripe_idx", sql: `CREATE INDEX IF NOT EXISTS "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId")` },

  // -- license_keys table --
  { label: "license_keys_table", sql: `CREATE TABLE IF NOT EXISTS "license_keys" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "organizationId" TEXT, "key" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "activatedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "maxActivations" INTEGER NOT NULL DEFAULT 1, "currentActivations" INTEGER NOT NULL DEFAULT 0, "planTier" TEXT, "features" TEXT, "notes" TEXT, "createdBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id"), CONSTRAINT "license_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE)` },
  { label: "license_key_unique", sql: `CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_key_key" ON "license_keys"("key")` },
  { label: "license_orgId_idx", sql: `CREATE INDEX IF NOT EXISTS "license_keys_organizationId_idx" ON "license_keys"("organizationId")` },
  { label: "license_status_idx", sql: `CREATE INDEX IF NOT EXISTS "license_keys_status_idx" ON "license_keys"("status")` },
  { label: "license_key_idx", sql: `CREATE INDEX IF NOT EXISTS "license_keys_key_idx" ON "license_keys"("key")` },

  // -- admin_audit_logs table --
  { label: "audit_logs_table", sql: `CREATE TABLE IF NOT EXISTS "admin_audit_logs" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "adminIdentifier" TEXT NOT NULL, "action" TEXT NOT NULL, "targetType" TEXT NOT NULL, "targetId" TEXT, "details" TEXT, "ipAddress" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id"))` },
  { label: "audit_admin_idx", sql: `CREATE INDEX IF NOT EXISTS "admin_audit_logs_adminIdentifier_idx" ON "admin_audit_logs"("adminIdentifier")` },
  { label: "audit_action_idx", sql: `CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action")` },
  { label: "audit_target_idx", sql: `CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId")` },
  { label: "audit_created_idx", sql: `CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt")` },
];

export async function POST(request: NextRequest) {
  const seedHeader = request.headers.get("x-seed-secret");
  if (seedHeader !== SEED_SECRET) {
    return NextResponse.json({ success: false, error: "Invalid seed secret" }, { status: 401 });
  }

  const results: Array<{ step: string; status: string; detail?: string }> = [];

  // Step 1: Execute each SQL statement individually
  for (const stmt of SQL_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt.sql);
      results.push({ step: stmt.label, status: "OK" });
    } catch (error: any) {
      const msg = error.message?.slice(0, 150) || "unknown";
      if (msg.includes("already exists")) {
        results.push({ step: stmt.label, status: "ALREADY_EXISTS" });
      } else {
        results.push({ step: stmt.label, status: "ERROR", detail: msg });
      }
    }
  }

  // Step 2: Seed default plans via raw SQL
  const planResults: Array<{ slug: string; status: string }> = [];

  for (const p of DEFAULT_PLANS) {
    try {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "plans" WHERE "slug" = $1 LIMIT 1`,
        p.slug
      ) as any[];

      if (existing.length > 0) {
        planResults.push({ slug: p.slug, status: "ALREADY_EXISTS" });
        continue;
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "plans" ("id", "name", "slug", "description", "tier", "maxSeats", "maxDeals", "maxLeads", "maxStorageMB", "maxAICallsPerMonth", "maxIntegrations", "enabledModules", "enabledFeatures", "priceMonthly", "priceAnnual", "currency", "trialDays", "isActive", "isPublic", "sortOrder", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        p.name, p.slug, p.description, p.tier,
        p.maxSeats, p.maxDeals, p.maxLeads, p.maxStorageMB,
        p.maxAICallsPerMonth, p.maxIntegrations,
        p.enabledModules, p.enabledFeatures,
        p.priceMonthly, p.priceAnnual, p.currency, p.trialDays,
        p.isPublic, p.sortOrder
      );
      planResults.push({ slug: p.slug, status: "CREATED" });
    } catch (error: any) {
      planResults.push({ slug: p.slug, status: `ERROR: ${error.message?.slice(0, 150)}` });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      message: "Bootstrap complete",
      schema: results,
      plans: planResults,
      timestamp: new Date().toISOString(),
    },
  });
}
