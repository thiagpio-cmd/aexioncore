-- CreateTable
CREATE TABLE "icp_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "idealIndustries" TEXT,
    "idealCompanySizeMin" INTEGER,
    "idealCompanySizeMax" INTEGER,
    "idealAnnualRevenueMinBRL" INTEGER,
    "idealAnnualRevenueMaxBRL" INTEGER,
    "bigFiveProfile" TEXT,
    "motivationProfile" TEXT,
    "decisionStyle" TEXT,
    "riskTolerance" TEXT,
    "valueDrivers" TEXT,
    "avgDealValueBRL" INTEGER,
    "avgSalesCycleDays" INTEGER,
    "avgWinRate" INTEGER,
    "topObjections" TEXT,
    "topWinReasons" TEXT,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "icp_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "icp_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "icpProfileId" TEXT NOT NULL,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "fitScore" INTEGER NOT NULL,
    "firmographicScore" INTEGER NOT NULL,
    "psychographicScore" INTEGER NOT NULL,
    "breakdown" TEXT,
    "scoreLabel" TEXT,
    "computedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "icp_scores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "icp_scores_icpProfileId_fkey" FOREIGN KEY ("icpProfileId") REFERENCES "icp_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "icp_scores_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "icp_scores_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bigFive" TEXT,
    "jungArchetype" TEXT,
    "lifestyle" TEXT,
    "valueSensitivity" TEXT,
    "motivationProfile" TEXT,
    "conditioningProfile" TEXT,
    "fomapScore" INTEGER,
    "confidence" REAL DEFAULT 0,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "customer_profiles_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "icp_profiles_organizationId_idx" ON "icp_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "icp_profiles_organizationId_isActive_idx" ON "icp_profiles"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "icp_scores_organizationId_idx" ON "icp_scores"("organizationId");

-- CreateIndex
CREATE INDEX "icp_scores_icpProfileId_idx" ON "icp_scores"("icpProfileId");

-- CreateIndex
CREATE INDEX "icp_scores_leadId_idx" ON "icp_scores"("leadId");

-- CreateIndex
CREATE INDEX "icp_scores_opportunityId_idx" ON "icp_scores"("opportunityId");

-- CreateIndex
CREATE INDEX "customer_profiles_contactId_idx" ON "customer_profiles"("contactId");

-- CreateIndex
CREATE INDEX "customer_profiles_organizationId_idx" ON "customer_profiles"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_contactId_organizationId_key" ON "customer_profiles"("contactId", "organizationId");
