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
    enabledFeatures: JSON.stringify({
      customBranding: false,
      rbacCustom: false,
      apiAccess: false,
      advancedReports: false,
      playbooks: false,
    }),
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
    enabledFeatures: JSON.stringify({
      customBranding: false,
      rbacCustom: false,
      apiAccess: false,
      advancedReports: false,
      playbooks: false,
    }),
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
    enabledFeatures: JSON.stringify({
      customBranding: true,
      rbacCustom: true,
      apiAccess: true,
      advancedReports: true,
      playbooks: true,
    }),
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
    enabledFeatures: JSON.stringify({
      customBranding: true,
      rbacCustom: true,
      apiAccess: true,
      advancedReports: true,
      playbooks: true,
      sso: true,
      dedicatedSupport: true,
      customIntegrations: true,
    }),
    priceMonthly: 0,
    priceAnnual: 0,
    currency: "USD",
    trialDays: 30,
    isPublic: true,
    sortOrder: 3,
  },
];

export async function POST(request: NextRequest) {
  // Auth check — same as seed endpoint
  const seedHeader = request.headers.get("x-seed-secret");
  if (seedHeader !== SEED_SECRET) {
    return NextResponse.json(
      { success: false, error: "Invalid seed secret" },
      { status: 401 }
    );
  }

  const results: Array<{ step: string; status: string; detail?: any }> = [];

  // Step 1: Create tables via raw SQL
  const migrations = [
    {
      table: "plans",
      sql: `
        CREATE TABLE IF NOT EXISTS "plans" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "name" TEXT NOT NULL,
          "slug" TEXT NOT NULL,
          "description" TEXT,
          "tier" TEXT NOT NULL DEFAULT 'STARTER',
          "maxSeats" INTEGER NOT NULL DEFAULT 5,
          "maxDeals" INTEGER NOT NULL DEFAULT 100,
          "maxLeads" INTEGER NOT NULL DEFAULT 500,
          "maxStorageMB" INTEGER NOT NULL DEFAULT 1024,
          "maxAICallsPerMonth" INTEGER NOT NULL DEFAULT 200,
          "maxIntegrations" INTEGER NOT NULL DEFAULT 3,
          "enabledModules" TEXT,
          "enabledFeatures" TEXT,
          "priceMonthly" INTEGER NOT NULL DEFAULT 0,
          "priceAnnual" INTEGER NOT NULL DEFAULT 0,
          "currency" TEXT NOT NULL DEFAULT 'USD',
          "trialDays" INTEGER NOT NULL DEFAULT 14,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "isPublic" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "metadata" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "plans_slug_key" ON "plans"("slug");
        CREATE INDEX IF NOT EXISTS "plans_tier_idx" ON "plans"("tier");
        CREATE INDEX IF NOT EXISTS "plans_isActive_isPublic_idx" ON "plans"("isActive", "isPublic");
      `,
    },
    {
      table: "subscriptions",
      sql: `
        CREATE TABLE IF NOT EXISTS "subscriptions" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "organizationId" TEXT NOT NULL,
          "planId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'TRIALING',
          "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
          "trialStart" TIMESTAMP(3),
          "trialEnd" TIMESTAMP(3),
          "canceledAt" TIMESTAMP(3),
          "cancelReason" TEXT,
          "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
          "stripeSubscriptionId" TEXT,
          "stripeCustomerId" TEXT,
          "seatOverride" INTEGER,
          "featureOverrides" TEXT,
          "metadata" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "subscriptions_organizationId_idx" ON "subscriptions"("organizationId");
        CREATE INDEX IF NOT EXISTS "subscriptions_planId_idx" ON "subscriptions"("planId");
        CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
        CREATE INDEX IF NOT EXISTS "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId");
      `,
    },
    {
      table: "usage_records",
      sql: `
        CREATE TABLE IF NOT EXISTS "usage_records" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "organizationId" TEXT NOT NULL,
          "subscriptionId" TEXT,
          "metric" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL DEFAULT 0,
          "limitVal" INTEGER NOT NULL DEFAULT 0,
          "overage" INTEGER NOT NULL DEFAULT 0,
          "periodStart" TIMESTAMP(3) NOT NULL,
          "periodEnd" TIMESTAMP(3) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "usage_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "usage_records_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "usage_records_orgId_metric_idx" ON "usage_records"("organizationId", "metric");
        CREATE INDEX IF NOT EXISTS "usage_records_orgId_periodStart_idx" ON "usage_records"("organizationId", "periodStart");
        CREATE INDEX IF NOT EXISTS "usage_records_subscriptionId_idx" ON "usage_records"("subscriptionId");
      `,
    },
    {
      table: "invoices",
      sql: `
        CREATE TABLE IF NOT EXISTS "invoices" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "organizationId" TEXT NOT NULL,
          "subscriptionId" TEXT,
          "invoiceNumber" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'DRAFT',
          "amountDue" INTEGER NOT NULL DEFAULT 0,
          "amountPaid" INTEGER NOT NULL DEFAULT 0,
          "currency" TEXT NOT NULL DEFAULT 'USD',
          "periodStart" TIMESTAMP(3),
          "periodEnd" TIMESTAMP(3),
          "dueDate" TIMESTAMP(3),
          "paidAt" TIMESTAMP(3),
          "lineItems" TEXT,
          "stripeInvoiceId" TEXT,
          "pdfUrl" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
        CREATE INDEX IF NOT EXISTS "invoices_organizationId_idx" ON "invoices"("organizationId");
        CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");
        CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");
        CREATE INDEX IF NOT EXISTS "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId");
      `,
    },
    {
      table: "license_keys",
      sql: `
        CREATE TABLE IF NOT EXISTS "license_keys" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "organizationId" TEXT,
          "key" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "activatedAt" TIMESTAMP(3),
          "expiresAt" TIMESTAMP(3),
          "maxActivations" INTEGER NOT NULL DEFAULT 1,
          "currentActivations" INTEGER NOT NULL DEFAULT 0,
          "planTier" TEXT,
          "features" TEXT,
          "notes" TEXT,
          "createdBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "license_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_key_key" ON "license_keys"("key");
        CREATE INDEX IF NOT EXISTS "license_keys_organizationId_idx" ON "license_keys"("organizationId");
        CREATE INDEX IF NOT EXISTS "license_keys_status_idx" ON "license_keys"("status");
        CREATE INDEX IF NOT EXISTS "license_keys_key_idx" ON "license_keys"("key");
      `,
    },
    {
      table: "admin_audit_logs",
      sql: `
        CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "adminIdentifier" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "targetType" TEXT NOT NULL,
          "targetId" TEXT,
          "details" TEXT,
          "ipAddress" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
        );
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_adminIdentifier_idx" ON "admin_audit_logs"("adminIdentifier");
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");
      `,
    },
  ];

  for (const migration of migrations) {
    try {
      await prisma.$executeRawUnsafe(migration.sql);
      results.push({ step: `create_table_${migration.table}`, status: "OK" });
    } catch (error: any) {
      if (error.code === "42P07" || error.message?.includes("already exists")) {
        results.push({ step: `create_table_${migration.table}`, status: "ALREADY_EXISTS" });
      } else {
        results.push({
          step: `create_table_${migration.table}`,
          status: "ERROR",
          detail: error.message?.slice(0, 200),
        });
      }
    }
  }

  // Step 2: Seed default plans
  const planResults: Array<{ slug: string; status: string }> = [];

  for (const planData of DEFAULT_PLANS) {
    try {
      // Check if plan exists
      const existing = await prisma.$queryRawUnsafe(
        `SELECT "id" FROM "plans" WHERE "slug" = $1 LIMIT 1`,
        planData.slug
      ) as any[];

      if (existing.length > 0) {
        planResults.push({ slug: planData.slug, status: "ALREADY_EXISTS" });
        continue;
      }

      // Insert plan
      await prisma.$executeRawUnsafe(
        `INSERT INTO "plans" ("id", "name", "slug", "description", "tier", "maxSeats", "maxDeals", "maxLeads", "maxStorageMB", "maxAICallsPerMonth", "maxIntegrations", "enabledModules", "enabledFeatures", "priceMonthly", "priceAnnual", "currency", "trialDays", "isActive", "isPublic", "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        planData.name,
        planData.slug,
        planData.description,
        planData.tier,
        planData.maxSeats,
        planData.maxDeals,
        planData.maxLeads,
        planData.maxStorageMB,
        planData.maxAICallsPerMonth,
        planData.maxIntegrations,
        planData.enabledModules,
        planData.enabledFeatures,
        planData.priceMonthly,
        planData.priceAnnual,
        planData.currency,
        planData.trialDays,
        planData.isPublic,
        planData.sortOrder
      );
      planResults.push({ slug: planData.slug, status: "CREATED" });
    } catch (error: any) {
      planResults.push({ slug: planData.slug, status: `ERROR: ${error.message?.slice(0, 150)}` });
    }
  }

  results.push({ step: "seed_plans", status: "DONE", detail: planResults });

  return NextResponse.json({
    success: true,
    data: {
      message: "Bootstrap complete — tables created and plans seeded",
      results,
      timestamp: new Date().toISOString(),
    },
  });
}
