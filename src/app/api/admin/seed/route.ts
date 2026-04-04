import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import * as bcrypt from "bcryptjs";

/**
 * POST /api/admin/seed
 * Seeds the database with US real estate demo data.
 * Protected by a simple secret header to prevent abuse.
 *
 * Usage: POST /api/admin/seed with header X-Seed-Secret: aexion-seed-2026
 */

const SEED_SECRET = process.env.SEED_SECRET || "aexion-seed-2026";

// Date helpers
const now = new Date();
const d = (daysAgo: number, hours = 10) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() - daysAgo);
  dt.setHours(hours, 0, 0, 0);
  return dt;
};
const future = (daysAhead: number, hours = 14) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + daysAhead);
  dt.setHours(hours, 0, 0, 0);
  return dt;
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-seed-secret");
  if (secret !== SEED_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ─── Ensure missing columns exist (schema drift fix) ─────────────
    // The initial migration only created minimal tables. Many columns were
    // added to the Prisma schema later without migrations. We add them here
    // via raw SQL with IF NOT EXISTS to avoid errors on re-runs.
    const addCol = (table: string, col: string, type: string, def?: string) =>
      prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" ${type}${def ? ` DEFAULT ${def}` : ""}`
      );

    // Organizations — missing columns
    await addCol("organizations", "displayName", "TEXT");
    await addCol("organizations", "logoUrl", "TEXT");
    await addCol("organizations", "primaryColor", "TEXT", "'#2457FF'");
    await addCol("organizations", "secondaryColor", "TEXT", "'#1a1a2e'");
    await addCol("organizations", "favicon", "TEXT");
    await addCol("organizations", "brandAccentColor", "TEXT");
    await addCol("organizations", "brandThemeDefault", "TEXT", "'dark'");
    await addCol("organizations", "brandLogoMarkUrl", "TEXT");
    await addCol("organizations", "enabledModules", "TEXT");
    await addCol("organizations", "rolePermissions", "TEXT");
    await addCol("organizations", "setupCompleted", "BOOLEAN", "false");
    await addCol("organizations", "setupStep", "INTEGER", "0");
    await addCol("organizations", "industry", "TEXT");
    await addCol("organizations", "defaultCurrency", "TEXT", "'USD'");
    await addCol("organizations", "fiscalYearStart", "INTEGER", "1");
    await addCol("organizations", "timezone", "TEXT", "'UTC'");
    await addCol("organizations", "defaultCurrencyCode", "TEXT", "'USD'");
    await addCol("organizations", "icpProfileId", "TEXT");
    await addCol("organizations", "defaultCommissionRate", "DOUBLE PRECISION");
    await addCol("organizations", "moneyEngineEnabled", "BOOLEAN", "true");
    await addCol("organizations", "pressureThresholds", "JSONB");

    // Users — missing columns
    await addCol("users", "notificationPrefs", "TEXT");
    await addCol("users", "executionScore", "INTEGER");
    await addCol("users", "behavioralFlags", "JSONB");
    await addCol("users", "performanceTrend", "TEXT");
    await addCol("users", "lastScoredAt", "TIMESTAMPTZ");

    // Accounts — missing post-sale columns
    await addCol("accounts", "isCustomer", "BOOLEAN", "false");
    await addCol("accounts", "becameCustomerAt", "TIMESTAMPTZ");
    await addCol("accounts", "deliveryDate", "TIMESTAMPTZ");
    await addCol("accounts", "activationDate", "TIMESTAMPTZ");
    await addCol("accounts", "onboardingStatus", "TEXT", "'PENDING'");
    await addCol("accounts", "implementationDelayDays", "INTEGER");
    await addCol("accounts", "churnDate", "TIMESTAMPTZ");
    await addCol("accounts", "churnReason", "TEXT");
    await addCol("accounts", "churnRepId", "TEXT");

    // Leads — missing column
    await addCol("leads", "icpScoreId", "TEXT");

    // Opportunities — missing scoring/loss columns
    await addCol("opportunities", "closedAt", "TIMESTAMPTZ");
    await addCol("opportunities", "lossReason", "TEXT");
    await addCol("opportunities", "lossNotes", "TEXT");
    await addCol("opportunities", "valueBRL", "INTEGER", "0");
    await addCol("opportunities", "icpScoreId", "TEXT");
    await addCol("opportunities", "moneyAtRisk", "DOUBLE PRECISION");
    await addCol("opportunities", "commissionAtRisk", "DOUBLE PRECISION");
    await addCol("opportunities", "delayCost", "DOUBLE PRECISION");
    await addCol("opportunities", "riskScore", "INTEGER");
    await addCol("opportunities", "intentScore", "INTEGER");
    await addCol("opportunities", "momentumScore", "INTEGER");
    await addCol("opportunities", "readinessScore", "INTEGER");
    await addCol("opportunities", "priceSensitivity", "INTEGER");
    await addCol("opportunities", "competitivePressure", "INTEGER");
    await addCol("opportunities", "riskReasons", "JSONB");
    await addCol("opportunities", "lastScoredAt", "TIMESTAMPTZ");

    // Contacts — add ownerId if missing (migration exists but may not have run)
    await addCol("contacts", "ownerId", "TEXT");

    // ─── Create ICP tables if missing ─────────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "icp_profiles" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
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
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "icp_profiles_orgId" ON "icp_profiles"("organizationId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "icp_profiles_orgActive" ON "icp_profiles"("organizationId", "isActive")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "icp_scores" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "icpProfileId" TEXT NOT NULL REFERENCES "icp_profiles"("id") ON DELETE CASCADE,
        "leadId" TEXT REFERENCES "leads"("id") ON DELETE SET NULL,
        "opportunityId" TEXT REFERENCES "opportunities"("id") ON DELETE SET NULL,
        "fitScore" INTEGER NOT NULL,
        "firmographicScore" INTEGER NOT NULL,
        "psychographicScore" INTEGER NOT NULL,
        "breakdown" TEXT,
        "scoreLabel" TEXT,
        "computedAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "icp_scores_orgId" ON "icp_scores"("organizationId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "icp_scores_profileId" ON "icp_scores"("icpProfileId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "icp_scores_leadId" ON "icp_scores"("leadId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "icp_scores_oppId" ON "icp_scores"("opportunityId")`);

    // ─── Create Debrief tables if missing ──────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "debriefs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "opportunityId" TEXT NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "users"("id"),
        "inputType" TEXT NOT NULL,
        "rawInput" TEXT NOT NULL,
        "fileUrl" TEXT,
        "interpretation" JSONB,
        "proposedActions" JSONB,
        "approvedActions" JSONB,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "confidence" DOUBLE PRECISION,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debriefs_oppId" ON "debriefs"("opportunityId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debriefs_userId" ON "debriefs"("userId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debriefs_orgStatus" ON "debriefs"("organizationId", "status")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "action_proposals" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "opportunityId" TEXT NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "users"("id"),
        "debriefId" TEXT REFERENCES "debriefs"("id") ON DELETE SET NULL,
        "source" TEXT NOT NULL,
        "actionType" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "urgency" TEXT NOT NULL,
        "params" JSONB NOT NULL DEFAULT '{}',
        "financialImpact" TEXT,
        "status" TEXT NOT NULL DEFAULT 'proposed',
        "executedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "action_proposals_oppStatus" ON "action_proposals"("opportunityId", "status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "action_proposals_userStatus" ON "action_proposals"("userId", "status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "action_proposals_orgStatus" ON "action_proposals"("organizationId", "status")`);

    // ─── Create DebriefSession table if missing ─────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "debrief_sessions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "createdById" TEXT NOT NULL REFERENCES "users"("id"),
        "opportunityId" TEXT REFERENCES "opportunities"("id") ON DELETE SET NULL,
        "leadId" TEXT REFERENCES "leads"("id") ON DELETE SET NULL,
        "title" TEXT NOT NULL,
        "inputType" TEXT NOT NULL,
        "rawInput" TEXT NOT NULL,
        "aiInterpretation" TEXT,
        "suggestedTasks" TEXT,
        "suggestedUpdates" TEXT,
        "userApproved" BOOLEAN NOT NULL DEFAULT false,
        "approvedAt" TIMESTAMPTZ,
        "appliedAt" TIMESTAMPTZ,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debrief_sessions_orgId" ON "debrief_sessions"("organizationId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debrief_sessions_oppId" ON "debrief_sessions"("opportunityId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debrief_sessions_leadId" ON "debrief_sessions"("leadId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "debrief_sessions_createdById" ON "debrief_sessions"("createdById")`);

    // ─── Clear all tables ─────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`DELETE FROM "action_proposals"`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "debriefs"`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "debrief_sessions"`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "icp_scores"`).catch(() => {});
    await prisma.$executeRawUnsafe(`DELETE FROM "icp_profiles"`).catch(() => {});
    await prisma.auditLog.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.integrationCredential.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.forecastSnapshot.deleteMany();
    await prisma.savedReport.deleteMany();
    await prisma.playbookStep.deleteMany();
    await prisma.playbook.deleteMany();
    await prisma.recommendation.deleteMany();
    await prisma.insight.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.inboxMessage.deleteMany();
    await prisma.task.deleteMany();
    await prisma.opportunity.deleteMany();
    await prisma.stage.deleteMany();
    await prisma.pipeline.deleteMany();
    await prisma.account.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();
    await prisma.organization.deleteMany();

    // ─── Organization ───────────────────────────────────────────────
    const org = await prisma.organization.create({
      data: {
        name: "Aexion Core",
        slug: "aexion-realty",
        displayName: "Aexion Core",
        industry: "Real Estate",
        defaultCurrency: "USD",
        timezone: "America/New_York",
        setupCompleted: true,
        setupStep: 5,
        enabledModules: JSON.stringify(["commercial", "data", "reports", "automation", "post_sale", "playbooks"]),
      },
    });
    const O = org.id;

    // ─── Teams (4) ──────────────────────────────────────────────────
    const sdrTeam = await prisma.team.create({ data: { organizationId: O, name: "Lead Generation", description: "Inbound leads, cold outreach, and prospect qualification" } });
    const closerTeam = await prisma.team.create({ data: { organizationId: O, name: "Luxury Sales", description: "High-ticket property transactions and client management" } });
    const mgrTeam = await prisma.team.create({ data: { organizationId: O, name: "Sales Leadership", description: "Sales strategy, coaching, and pipeline oversight" } });
    const execTeam = await prisma.team.create({ data: { organizationId: O, name: "Executive Team", description: "Brokerage leadership and strategic direction" } });

    // ─── Users (7) ──────────────────────────────────────────────────
    const adminPw = await bcrypt.hash("aexion123", 10);
    const demoPw = await bcrypt.hash("demo123", 10);
    const mkUser = (email: string, name: string, role: string, workspace: string, teamId: string, password: string) =>
      prisma.user.create({ data: { organizationId: O, teamId, email, name, password, role, workspace, isActive: true } });

    const aexionAdmin = await mkUser("admin@aexioncore.com",       "Thiago Pio",         "ADMIN",   "EXECUTIVE", execTeam.id, adminPw);
    const sarah       = await mkUser("kim@aexioncore.com",         "Kim Sangawa",        "ADMIN",   "EXECUTIVE", execTeam.id, demoPw);
    const mike        = await mkUser("alexandre@aexioncore.com",   "Alexandre Henrique", "ADMIN",   "EXECUTIVE", mgrTeam.id,  demoPw);
    const emma        = await mkUser("emma@aexioncore.com",        "Emma Blackwell",     "CLOSER",  "CLOSER",    closerTeam.id, demoPw);
    const james       = await mkUser("james@aexioncore.com",       "James Whitfield",    "CLOSER",  "CLOSER",    closerTeam.id, demoPw);
    const alex        = await mkUser("alex@aexioncore.com",        "Alex Rivera",        "SDR",     "SDR",       sdrTeam.id,  demoPw);
    const rachel      = await mkUser("rachel@aexioncore.com",      "Rachel Kim",         "SDR",     "SDR",       sdrTeam.id,  demoPw);

    await prisma.team.update({ where: { id: sdrTeam.id }, data: { managerId: mike.id } });
    await prisma.team.update({ where: { id: closerTeam.id }, data: { managerId: mike.id } });
    await prisma.team.update({ where: { id: mgrTeam.id }, data: { managerId: aexionAdmin.id } });
    await prisma.team.update({ where: { id: execTeam.id }, data: { managerId: aexionAdmin.id } });

    // ─── Companies (20) — US Real Estate ────────────────────────────
    const mkCo = (name: string, industry: string, size: string, website: string, annualRevenue?: number) =>
      prisma.company.create({ data: { organizationId: O, name, industry, size, website, annualRevenue } });

    const coWestfield    = await mkCo("Westfield Development Group",    "Luxury Residential Development", "51-200",    "https://westfielddev.com",        450000000);
    const coPalmetto     = await mkCo("Palmetto Capital Partners",      "Real Estate Private Equity",     "11-50",     "https://palmettocapital.com",     280000000);
    const coSilverstone  = await mkCo("Silverstone Properties",         "Commercial Real Estate",         "201-500",   "https://silverstoneproperties.com",620000000);
    const coCoastal      = await mkCo("Coastal Living Homes",           "Luxury Home Builder",            "51-200",    "https://coastallivinghomes.com",  185000000);
    const coSummitPeak   = await mkCo("Summit Peak Investments",        "Real Estate Investment Trust",   "201-500",   "https://summitpeakinvest.com",    920000000);
    const coHarbor       = await mkCo("Harbor View Realty",             "Residential Brokerage",          "11-50",     "https://harborviewrealty.com",     42000000);
    const coMeridianRE   = await mkCo("Meridian Real Estate Advisors",  "Commercial Brokerage",          "51-200",    "https://meridianreadvisors.com",  110000000);
    const coPrestige     = await mkCo("Prestige Property Management",   "Property Management",           "201-500",   "https://prestigepm.com",          75000000);
    const coBlueSky      = await mkCo("Blue Sky Land Company",          "Land Development",              "11-50",     "https://blueskylandco.com",       55000000);
    const coGoldCoast    = await mkCo("Gold Coast Luxury Estates",      "Ultra-Luxury Residential",      "11-50",     "https://goldcoastluxury.com",     320000000);
    const coMetroNest    = await mkCo("MetroNest Urban Living",         "Urban Multifamily Development",  "51-200",    "https://metronest.com",           210000000);
    const coHeritage     = await mkCo("Heritage Homes of America",      "Custom Home Builder",           "51-200",    "https://heritagehomesusa.com",    145000000);
    const coEvergreen    = await mkCo("Evergreen Property Group",       "Mixed-Use Development",         "201-500",   "https://evergreenpropertygroup.com",380000000);
    const coIronGate     = await mkCo("Iron Gate Capital",              "RE Debt & Equity Fund",         "11-50",     "https://irongatecapital.com",     160000000);
    const coVista        = await mkCo("Vista Ridge Communities",        "Master-Planned Communities",    "51-200",    "https://vistaridgecommunities.com",290000000);
    const coLakeside     = await mkCo("Lakeside Resort Properties",     "Hospitality & Resort RE",       "51-200",    "https://lakesideresorts.com",     130000000);
    const coAtlantic     = await mkCo("Atlantic Shores Development",    "Beachfront Development",        "11-50",     "https://atlanticshoresdev.com",    95000000);
    const coMaple        = await mkCo("Maple Street Partners",          "Affordable Housing Developer",  "51-200",    "https://maplestreetpartners.com",  68000000);
    const coSkyline      = await mkCo("Skyline Tower Group",            "High-Rise Development",         "201-500",   "https://skylinetowergroup.com",   510000000);
    const coPinnacleRE   = await mkCo("Pinnacle Real Estate Holdings",  "Diversified RE Holdings",       "501-1000",  "https://pinnaclereholdings.com",  780000000);

    // ─── Contacts (35) ──────────────────────────────────────────────
    const mkContact = (name: string, email: string, title: string, companyId: string, phone?: string, isDecisionMaker = false, isChampion = false) =>
      prisma.contact.create({ data: { organizationId: O, name, email, title, companyId, phone, isDecisionMaker, isChampion } });

    const ctRobertWest     = await mkContact("Robert Westfield",     "robert@westfielddev.com",         "CEO & Founder",                     coWestfield.id,   "(305) 555-0142", true,  false);
    const ctCatherinePalm  = await mkContact("Catherine Palmer",     "catherine@palmettocapital.com",   "Managing Partner",                  coPalmetto.id,    "(212) 555-0198", true,  true);
    const ctMarcusSilver   = await mkContact("Marcus Silverstein",   "marcus@silverstoneproperties.com","Chief Investment Officer",           coSilverstone.id, "(312) 555-0234", true,  false);
    const ctDianaCoast     = await mkContact("Diana Coastal",        "diana@coastallivinghomes.com",    "VP of Sales",                       coCoastal.id,     "(843) 555-0267", true,  true);
    const ctJamesSummit    = await mkContact("James Thornton",       "james@summitpeakinvest.com",      "Director of Acquisitions",          coSummitPeak.id,  "(415) 555-0311", true,  true);
    const ctLindaHarbor    = await mkContact("Linda Chen",           "linda@harborviewrealty.com",       "Broker/Owner",                      coHarbor.id,      "(619) 555-0445", true,  false);
    const ctThomasMerid    = await mkContact("Thomas Grant",         "thomas@meridianreadvisors.com",   "Senior Managing Director",          coMeridianRE.id,  "(202) 555-0478", true,  true);
    const ctNataliePress   = await mkContact("Natalie Pressman",     "natalie@prestigepm.com",          "CEO",                               coPrestige.id,    "(404) 555-0523", true,  true);
    const ctBenBlueSky     = await mkContact("Benjamin Crawford",    "ben@blueskylandco.com",           "President",                         coBlueSky.id,     "(512) 555-0612", true,  false);
    const ctSophiaGold     = await mkContact("Sophia Goldstein",     "sophia@goldcoastluxury.com",      "Principal Broker",                  coGoldCoast.id,   "(561) 555-0634", true,  true);
    const ctChrisMetro     = await mkContact("Chris Nakamura",       "chris@metronest.com",             "VP of Development",                 coMetroNest.id,   "(646) 555-0789", true,  false);
    const ctKarenHeritage  = await mkContact("Karen O'Brien",        "karen@heritagehomesusa.com",      "Chief Operating Officer",           coHeritage.id,    "(704) 555-0845", false, true);
    const ctDavidEvergreen = await mkContact("David Park",           "david@evergreenpropertygroup.com","Managing Director",                  coEvergreen.id,   "(310) 555-0923", true,  false);
    const ctAmandaIron     = await mkContact("Amanda Blackstone",    "amanda@irongatecapital.com",      "Partner, Real Estate",              coIronGate.id,    "(617) 555-1034", true,  false);
    const ctBrianVista     = await mkContact("Brian Foster",         "brian@vistaridgecommunities.com", "VP of Land Acquisition",            coVista.id,       "(480) 555-1067", false, true);
    const ctMichelleLake   = await mkContact("Michelle Torres",      "michelle@lakesideresorts.com",    "Director of Hospitality RE",        coLakeside.id,    "(828) 555-1145", true,  false);
    const ctAndrewAtl      = await mkContact("Andrew Mitchell",      "andrew@atlanticshoresdev.com",    "Founder & Developer",               coAtlantic.id,    "(904) 555-1234", true,  true);
    const ctLauraMaple     = await mkContact("Laura Washington",     "laura@maplestreetpartners.com",   "Director of Development",           coMaple.id,       "(215) 555-1356", true,  false);
    const ctKevinSkyline   = await mkContact("Kevin Zhang",          "kevin@skylinetowergroup.com",     "SVP of Development",                coSkyline.id,     "(786) 555-1478", true,  true);
    const ctRachelPinn     = await mkContact("Rachel Donnelly",      "rachel@pinnaclereholdings.com",   "Chief Acquisitions Officer",        coPinnacleRE.id,  "(214) 555-1523", true,  true);
    // Additional contacts
    const ctAliceWest      = await mkContact("Alice Montoya",        "alice@westfielddev.com",          "VP of Marketing",                   coWestfield.id,   "(305) 555-2245", false, false);
    const ctSteveSilver    = await mkContact("Steve Chambers",       "steve@silverstoneproperties.com", "Director of Leasing",               coSilverstone.id, "(312) 555-2356", false, false);
    const ctDianaSummit    = await mkContact("Diana Okafor",         "diana.o@summitpeakinvest.com",    "VP of Asset Management",            coSummitPeak.id,  "(415) 555-2467", false, false);
    const ctGregEvergreen  = await mkContact("Greg Patterson",       "greg@evergreenpropertygroup.com", "Director of Construction",          coEvergreen.id,   "(310) 555-2578", false, true);
    const ctHeatherPrestige= await mkContact("Heather Ross",         "heather@prestigepm.com",          "Regional Property Manager",         coPrestige.id,    "(404) 555-2689", false, false);
    const ctPatrickVista   = await mkContact("Patrick Sullivan",     "patrick@vistaridgecommunities.com","Community Sales Director",          coVista.id,       "(480) 555-2790", false, true);
    const ctCourtneyMaple  = await mkContact("Courtney Bell",        "courtney@maplestreetpartners.com","VP of Government Relations",        coMaple.id,       "(215) 555-2891", false, false);
    const ctTylerLake      = await mkContact("Tyler Nguyen",         "tyler@lakesideresorts.com",       "Director of Sales",                 coLakeside.id,    "(828) 555-2934", false, false);
    const ctJessicaPalm    = await mkContact("Jessica Hartley",      "jessica@palmettocapital.com",     "VP of Investor Relations",          coPalmetto.id,    "(212) 555-3045", false, true);
    const ctMattSkyline    = await mkContact("Matt Kaplan",          "matt@skylinetowergroup.com",      "Director of Sales",                 coSkyline.id,     "(786) 555-3156", false, false);

    // ─── Leads (25) — Real Estate Prospects ─────────────────────────
    const mkLead = (p: { name: string; email: string; phone?: string; title?: string; companyId: string; contactId: string; ownerId: string; source: string; status: string; temperature: string; fitScore: number; lastContact?: Date }) =>
      prisma.lead.create({ data: { organizationId: O, ...p } });

    const leads: any[] = [];
    // NEW (5)
    leads.push(await mkLead({ name: "Robert Westfield",     email: "robert@westfielddev.com",          phone: "(305) 555-0142", title: "CEO & Founder",             companyId: coWestfield.id,  contactId: ctRobertWest.id,    ownerId: alex.id,    source: "WEBSITE",    status: "NEW",          temperature: "WARM",  fitScore: 72 }));
    leads.push(await mkLead({ name: "Andrew Mitchell",      email: "andrew@atlanticshoresdev.com",     phone: "(904) 555-1234", title: "Founder & Developer",       companyId: coAtlantic.id,   contactId: ctAndrewAtl.id,     ownerId: rachel.id,  source: "REFERRAL",   status: "NEW",          temperature: "HOT",   fitScore: 88 }));
    leads.push(await mkLead({ name: "Laura Washington",     email: "laura@maplestreetpartners.com",    phone: "(215) 555-1356", title: "Director of Development",   companyId: coMaple.id,      contactId: ctLauraMaple.id,    ownerId: alex.id,    source: "LINKEDIN",   status: "NEW",          temperature: "COLD",  fitScore: 45 }));
    leads.push(await mkLead({ name: "Benjamin Crawford",    email: "ben@blueskylandco.com",            phone: "(512) 555-0612", title: "President",                 companyId: coBlueSky.id,    contactId: ctBenBlueSky.id,    ownerId: rachel.id,  source: "EVENT",      status: "NEW",          temperature: "WARM",  fitScore: 63 }));
    leads.push(await mkLead({ name: "Courtney Bell",        email: "courtney@maplestreetpartners.com", phone: "(215) 555-2891", title: "VP of Government Relations",companyId: coMaple.id,      contactId: ctCourtneyMaple.id, ownerId: alex.id,    source: "COLD_OUTBOUND",status: "NEW",        temperature: "COLD",  fitScore: 38 }));
    // CONTACTED (6)
    leads.push(await mkLead({ name: "Natalie Pressman",     email: "natalie@prestigepm.com",           phone: "(404) 555-0523", title: "CEO",                       companyId: coPrestige.id,   contactId: ctNataliePress.id,  ownerId: rachel.id,  source: "LINKEDIN",   status: "CONTACTED",    temperature: "WARM",  fitScore: 78, lastContact: d(3) }));
    leads.push(await mkLead({ name: "Michelle Torres",      email: "michelle@lakesideresorts.com",     phone: "(828) 555-1145", title: "Director of Hospitality RE",companyId: coLakeside.id,   contactId: ctMichelleLake.id,  ownerId: alex.id,    source: "WEBSITE",    status: "CONTACTED",    temperature: "WARM",  fitScore: 70, lastContact: d(5) }));
    leads.push(await mkLead({ name: "Brian Foster",         email: "brian@vistaridgecommunities.com",  phone: "(480) 555-1067", title: "VP of Land Acquisition",    companyId: coVista.id,      contactId: ctBrianVista.id,    ownerId: rachel.id,  source: "PARTNER",    status: "CONTACTED",    temperature: "WARM",  fitScore: 74, lastContact: d(2) }));
    leads.push(await mkLead({ name: "Patrick Sullivan",     email: "patrick@vistaridgecommunities.com",phone: "(480) 555-2790", title: "Community Sales Director",  companyId: coVista.id,      contactId: ctPatrickVista.id,  ownerId: alex.id,    source: "EVENT",      status: "CONTACTED",    temperature: "HOT",   fitScore: 82, lastContact: d(1) }));
    leads.push(await mkLead({ name: "Kevin Zhang",          email: "kevin@skylinetowergroup.com",      phone: "(786) 555-1478", title: "SVP of Development",        companyId: coSkyline.id,    contactId: ctKevinSkyline.id,  ownerId: rachel.id,  source: "REFERRAL",   status: "CONTACTED",    temperature: "HOT",   fitScore: 85, lastContact: d(1) }));
    leads.push(await mkLead({ name: "Karen O'Brien",        email: "karen@heritagehomesusa.com",       phone: "(704) 555-0845", title: "COO",                       companyId: coHeritage.id,   contactId: ctKarenHeritage.id, ownerId: alex.id,    source: "LINKEDIN",   status: "CONTACTED",    temperature: "WARM",  fitScore: 68, lastContact: d(7) }));
    // QUALIFIED (5)
    leads.push(await mkLead({ name: "Catherine Palmer",     email: "catherine@palmettocapital.com",    phone: "(212) 555-0198", title: "Managing Partner",          companyId: coPalmetto.id,   contactId: ctCatherinePalm.id, ownerId: alex.id,    source: "REFERRAL",   status: "QUALIFIED",    temperature: "HOT",   fitScore: 95, lastContact: d(1) }));
    leads.push(await mkLead({ name: "Marcus Silverstein",   email: "marcus@silverstoneproperties.com", phone: "(312) 555-0234", title: "Chief Investment Officer",  companyId: coSilverstone.id,contactId: ctMarcusSilver.id,  ownerId: rachel.id,  source: "EVENT",      status: "QUALIFIED",    temperature: "HOT",   fitScore: 92, lastContact: d(2) }));
    leads.push(await mkLead({ name: "Rachel Donnelly",      email: "rachel@pinnaclereholdings.com",    phone: "(214) 555-1523", title: "Chief Acquisitions Officer",companyId: coPinnacleRE.id, contactId: ctRachelPinn.id,    ownerId: alex.id,    source: "WEBSITE",    status: "QUALIFIED",    temperature: "HOT",   fitScore: 88, lastContact: d(1) }));
    leads.push(await mkLead({ name: "Amanda Blackstone",    email: "amanda@irongatecapital.com",       phone: "(617) 555-1034", title: "Partner, Real Estate",      companyId: coIronGate.id,   contactId: ctAmandaIron.id,    ownerId: rachel.id,  source: "PARTNER",    status: "QUALIFIED",    temperature: "WARM",  fitScore: 80, lastContact: d(4) }));
    leads.push(await mkLead({ name: "Sophia Goldstein",     email: "sophia@goldcoastluxury.com",       phone: "(561) 555-0634", title: "Principal Broker",          companyId: coGoldCoast.id,  contactId: ctSophiaGold.id,    ownerId: alex.id,    source: "LINKEDIN",   status: "QUALIFIED",    temperature: "WARM",  fitScore: 76, lastContact: d(3) }));
    // CONVERTED (4)
    leads.push(await mkLead({ name: "Diana Coastal",        email: "diana@coastallivinghomes.com",     phone: "(843) 555-0267", title: "VP of Sales",               companyId: coCoastal.id,    contactId: ctDianaCoast.id,    ownerId: alex.id,    source: "LINKEDIN",   status: "CONVERTED",    temperature: "HOT",   fitScore: 94, lastContact: d(12) }));
    leads.push(await mkLead({ name: "James Thornton",       email: "james@summitpeakinvest.com",       phone: "(415) 555-0311", title: "Director of Acquisitions",  companyId: coSummitPeak.id, contactId: ctJamesSummit.id,   ownerId: rachel.id,  source: "EVENT",      status: "CONVERTED",    temperature: "HOT",   fitScore: 90, lastContact: d(18) }));
    leads.push(await mkLead({ name: "Chris Nakamura",       email: "chris@metronest.com",              phone: "(646) 555-0789", title: "VP of Development",         companyId: coMetroNest.id,  contactId: ctChrisMetro.id,    ownerId: alex.id,    source: "REFERRAL",   status: "CONVERTED",    temperature: "HOT",   fitScore: 91, lastContact: d(15) }));
    leads.push(await mkLead({ name: "Thomas Grant",         email: "thomas@meridianreadvisors.com",    phone: "(202) 555-0478", title: "Senior Managing Director",  companyId: coMeridianRE.id, contactId: ctThomasMerid.id,   ownerId: rachel.id,  source: "COLD_OUTBOUND",status: "CONVERTED",  temperature: "WARM",  fitScore: 83, lastContact: d(20) }));
    // DISQUALIFIED (3)
    leads.push(await mkLead({ name: "Steve Chambers",       email: "steve@silverstoneproperties.com",  phone: "(312) 555-2356", title: "Director of Leasing",       companyId: coSilverstone.id,contactId: ctSteveSilver.id,   ownerId: rachel.id,  source: "WEBSITE",    status: "DISQUALIFIED", temperature: "COLD",  fitScore: 22 }));
    leads.push(await mkLead({ name: "Heather Ross",         email: "heather@prestigepm.com",           phone: "(404) 555-2689", title: "Regional Property Manager", companyId: coPrestige.id,   contactId: ctHeatherPrestige.id,ownerId: alex.id,   source: "COLD_OUTBOUND",status: "DISQUALIFIED",temperature: "COLD", fitScore: 18 }));
    leads.push(await mkLead({ name: "Tyler Nguyen",         email: "tyler@lakesideresorts.com",        phone: "(828) 555-2934", title: "Director of Sales",         companyId: coLakeside.id,   contactId: ctTylerLake.id,     ownerId: rachel.id,  source: "WEBSITE",    status: "DISQUALIFIED", temperature: "COLD",  fitScore: 30 }));
    // NURTURING (2)
    leads.push(await mkLead({ name: "David Park",           email: "david@evergreenpropertygroup.com", phone: "(310) 555-0923", title: "Managing Director",         companyId: coEvergreen.id,  contactId: ctDavidEvergreen.id,ownerId: alex.id,    source: "EVENT",      status: "NURTURING",    temperature: "WARM",  fitScore: 65, lastContact: d(10) }));
    leads.push(await mkLead({ name: "Linda Chen",           email: "linda@harborviewrealty.com",       phone: "(619) 555-0445", title: "Broker/Owner",              companyId: coHarbor.id,     contactId: ctLindaHarbor.id,   ownerId: rachel.id,  source: "PARTNER",    status: "NURTURING",    temperature: "WARM",  fitScore: 60, lastContact: d(14) }));

    // ─── Accounts (8) ───────────────────────────────────────────────
    const mkAcct = (name: string, companyId: string, ownerId: string, isCustomer = false, becameCustomerAt?: Date, onboardingStatus = "PENDING") =>
      prisma.account.create({ data: { organizationId: O, name, companyId, ownerId, status: "active", isCustomer, becameCustomerAt, onboardingStatus } });

    const acctPalmetto   = await mkAcct("Palmetto Capital — Fund III Deals",     coPalmetto.id,     emma.id,   true,  d(30), "COMPLETED");
    const acctSilverstone= await mkAcct("Silverstone — Office Portfolio",        coSilverstone.id,  james.id,  true,  d(45), "IN_PROGRESS");
    const acctCoastal    = await mkAcct("Coastal Living — Kiawah Development",   coCoastal.id,      emma.id);
    const acctSummitPeak = await mkAcct("Summit Peak — Multifamily Acquisition", coSummitPeak.id,   james.id);
    const acctMetroNest  = await mkAcct("MetroNest — Brooklyn Project",          coMetroNest.id,    emma.id);
    const acctMeridianRE = await mkAcct("Meridian — DC Office Leasing",          coMeridianRE.id,   james.id);
    const acctSkyline    = await mkAcct("Skyline Tower — Miami Condo Tower",     coSkyline.id,      emma.id);
    const acctEvergreen  = await mkAcct("Evergreen — Mixed-Use Austin",          coEvergreen.id,    james.id);

    // ─── Pipeline & Stages ──────────────────────────────────────────
    const pipeline = await prisma.pipeline.create({ data: { organizationId: O, name: "Real Estate Sales Pipeline", description: "High-ticket property and development deal pipeline" } });
    const stageData = [
      { name: "Lead Inquiry",    order: 1, color: "#3B82F6" },
      { name: "Property Tour",   order: 2, color: "#8B5CF6" },
      { name: "Offer Submitted", order: 3, color: "#F59E0B" },
      { name: "Under Contract",  order: 4, color: "#EF4444" },
      { name: "Due Diligence",   order: 5, color: "#06B6D4" },
      { name: "Closed Won",      order: 6, color: "#10B981" },
      { name: "Closed Lost",     order: 7, color: "#6B7280" },
    ];
    const stages: Record<string, string> = {};
    for (const s of stageData) {
      const st = await prisma.stage.create({ data: { pipelineId: pipeline.id, ...s } });
      stages[s.name] = st.id;
    }

    // ─── Opportunities (15) — Real Estate Deals ─────────────────────
    const mkOpp = (p: { title: string; description?: string; value: number; stage: string; stageId: string; probability: number; accountId: string; ownerId: string; ownerName: string; expectedCloseDate: Date; createdAt?: Date; primaryContactId?: string }) =>
      prisma.opportunity.create({ data: { organizationId: O, ...p } });

    const opps: any[] = [];
    // LEAD INQUIRY (3)
    opps.push(await mkOpp({ title: "Westfield — 42-Unit Luxury Condo (Coral Gables)",        description: "New luxury condo development, 42 units, waterfront location in Coral Gables FL",                                value: 2800000,  stage: "LEAD_INQUIRY",    stageId: stages["Lead Inquiry"],    probability: 15, accountId: acctSkyline.id,     ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: future(85),  primaryContactId: ctRobertWest.id }));
    opps.push(await mkOpp({ title: "Skyline Tower — Pre-Construction Sales (Brickell)",       description: "250 luxury condos in Miami's Brickell district, pre-construction phase marketing",                               value: 1200000,  stage: "LEAD_INQUIRY",    stageId: stages["Lead Inquiry"],    probability: 10, accountId: acctSkyline.id,     ownerId: james.id,  ownerName: "James Whitfield",   expectedCloseDate: future(90),  primaryContactId: ctKevinSkyline.id }));
    opps.push(await mkOpp({ title: "Gold Coast — Penthouse Portfolio (Palm Beach)",           description: "3 ultra-luxury penthouses in Palm Beach, $4M+ each, international buyer network",                                value: 850000,   stage: "LEAD_INQUIRY",    stageId: stages["Lead Inquiry"],    probability: 20, accountId: acctSkyline.id,     ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: future(75),  primaryContactId: ctSophiaGold.id }));
    // PROPERTY TOUR (3)
    opps.push(await mkOpp({ title: "Silverstone — 200K SF Office Campus (Reston, VA)",        description: "Class A office campus, 200,000 SF, Northern Virginia tech corridor, NNN lease",                                  value: 4500000,  stage: "PROPERTY_TOUR",   stageId: stages["Property Tour"],   probability: 35, accountId: acctSilverstone.id,  ownerId: james.id,  ownerName: "James Whitfield",   expectedCloseDate: future(60),  primaryContactId: ctMarcusSilver.id }));
    opps.push(await mkOpp({ title: "Coastal Living — 28-Lot Subdivision (Kiawah Island)",     description: "Master-planned 28-lot subdivision on Kiawah Island, SC. Lots avg $800K each",                                    value: 3200000,  stage: "PROPERTY_TOUR",   stageId: stages["Property Tour"],   probability: 40, accountId: acctCoastal.id,      ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: future(50),  primaryContactId: ctDianaCoast.id }));
    opps.push(await mkOpp({ title: "Palmetto Capital — 120-Unit Multifamily (Nashville)",     description: "Value-add multifamily acquisition, 120 units in Nashville submarket, 7.2% cap rate",                             value: 1800000,  stage: "PROPERTY_TOUR",   stageId: stages["Property Tour"],   probability: 45, accountId: acctPalmetto.id,     ownerId: james.id,  ownerName: "James Whitfield",   expectedCloseDate: future(45),  primaryContactId: ctCatherinePalm.id }));
    // OFFER SUBMITTED (2)
    opps.push(await mkOpp({ title: "Summit Peak — Waterfront Mixed-Use (Charleston)",         description: "12-story mixed-use waterfront development, retail + 180 residential units, Charleston SC",                       value: 8500000,  stage: "OFFER_SUBMITTED", stageId: stages["Offer Submitted"], probability: 55, accountId: acctSummitPeak.id,   ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: future(30),  primaryContactId: ctJamesSummit.id }));
    opps.push(await mkOpp({ title: "MetroNest — Brooklyn Heights Conversion (NYC)",           description: "Warehouse-to-residential conversion, 85 units, Brooklyn Heights, NYC approvals in hand",                         value: 5200000,  stage: "OFFER_SUBMITTED", stageId: stages["Offer Submitted"], probability: 60, accountId: acctMetroNest.id,    ownerId: james.id,  ownerName: "James Whitfield",   expectedCloseDate: future(25),  primaryContactId: ctChrisMetro.id }));
    // UNDER CONTRACT (2)
    opps.push(await mkOpp({ title: "Meridian — 350K SF Class A Office (Washington DC)",       description: "Trophy Class A office, Pennsylvania Ave, 350,000 SF, 95% occupied, 10-year hold strategy",                       value: 12000000, stage: "UNDER_CONTRACT",  stageId: stages["Under Contract"],  probability: 75, accountId: acctMeridianRE.id,   ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: future(14),  primaryContactId: ctThomasMerid.id }));
    opps.push(await mkOpp({ title: "Coastal Living — Luxury Estate Portfolio (Hilton Head)",   description: "Portfolio of 6 luxury waterfront estates, Hilton Head Island, $2.5M-$4.5M each",                                 value: 6800000,  stage: "UNDER_CONTRACT",  stageId: stages["Under Contract"],  probability: 80, accountId: acctCoastal.id,      ownerId: james.id,  ownerName: "James Whitfield",   expectedCloseDate: future(10),  primaryContactId: ctDianaCoast.id }));
    // DUE DILIGENCE (1)
    opps.push(await mkOpp({ title: "Palmetto Capital — Savannah Portfolio (8 Properties)",    description: "8-property portfolio in Savannah historic district, mix of retail and residential, stabilized",                   value: 9500000,  stage: "DUE_DILIGENCE",   stageId: stages["Due Diligence"],   probability: 90, accountId: acctPalmetto.id,     ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: future(5),   primaryContactId: ctCatherinePalm.id }));
    // CLOSED WON (2)
    opps.push(await mkOpp({ title: "Silverstone — Industrial Park (Atlanta)",                 description: "500,000 SF industrial distribution center, Atlanta metro, Amazon pre-lease",                                     value: 7200000,  stage: "CLOSED_WON",      stageId: stages["Closed Won"],      probability: 100, accountId: acctSilverstone.id, ownerId: james.id,  ownerName: "James Whitfield",   expectedCloseDate: d(5),  createdAt: d(60), primaryContactId: ctMarcusSilver.id }));
    opps.push(await mkOpp({ title: "Palmetto Capital — Charlotte Multifamily Disposition",    description: "Disposition of 220-unit Class B multifamily, Charlotte NC, held 4 years, 2.1x return",                            value: 15000000, stage: "CLOSED_WON",      stageId: stages["Closed Won"],      probability: 100, accountId: acctPalmetto.id,    ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: d(12), createdAt: d(75), primaryContactId: ctCatherinePalm.id }));
    // CLOSED LOST (2)
    opps.push(await mkOpp({ title: "Evergreen — Austin Mixed-Use (Lost to Competitor)",       description: "Lost to competing developer — better relationship with city planning commission",                                  value: 4200000,  stage: "CLOSED_LOST",     stageId: stages["Closed Lost"],     probability: 0,  accountId: acctEvergreen.id,   ownerId: emma.id,   ownerName: "Emma Blackwell",    expectedCloseDate: d(8),  createdAt: d(40) }));
    opps.push(await mkOpp({ title: "Lakeside Resort — Mountain Lodge Development",            description: "Buyer pulled out after environmental impact study raised concerns about wetland preservation",                     value: 3600000,  stage: "CLOSED_LOST",     stageId: stages["Closed Lost"],     probability: 0,  accountId: acctEvergreen.id,   ownerId: james.id,  ownerName: "James Whitfield",   expectedCloseDate: d(15), createdAt: d(50) }));

    // ─── Tasks (20) ─────────────────────────────────────────────────
    await prisma.task.createMany({
      data: [
        { organizationId: O, title: "Send Summit Peak mixed-use proposal to James Thornton",         type: "EMAIL",     priority: "HIGH",     status: "PENDING",     ownerId: emma.id,    opportunityId: opps[6].id,  dueDate: future(2) },
        { organizationId: O, title: "Schedule property tour — Coastal Living Kiawah lots",           type: "MEETING",   priority: "HIGH",     status: "PENDING",     ownerId: james.id,   opportunityId: opps[4].id,  dueDate: future(3) },
        { organizationId: O, title: "Prepare comparable market analysis for Meridian DC office",     type: "OTHER",     priority: "MEDIUM",   status: "PENDING",     ownerId: emma.id,    opportunityId: opps[8].id,  dueDate: future(5) },
        { organizationId: O, title: "Research Gold Coast buyer network for Palm Beach penthouses",   type: "OTHER",     priority: "LOW",      status: "PENDING",     ownerId: alex.id,    leadId: leads[16].id,       dueDate: future(4) },
        { organizationId: O, title: "Send investment memo to Kevin Zhang at Skyline Tower",          type: "EMAIL",     priority: "MEDIUM",   status: "PENDING",     ownerId: rachel.id,  leadId: leads[9].id,        dueDate: future(1) },
        // OVERDUE
        { organizationId: O, title: "Follow up with Catherine Palmer on Savannah portfolio terms",   type: "FOLLOW_UP", priority: "HIGH",     status: "PENDING",     ownerId: emma.id,    opportunityId: opps[10].id, dueDate: d(1) },
        { organizationId: O, title: "Return call from Marcus Silverstein — Reston office tour",      type: "CALL",      priority: "HIGH",     status: "PENDING",     ownerId: james.id,   leadId: leads[12].id,       dueDate: d(2) },
        { organizationId: O, title: "Send revised LOI for MetroNest Brooklyn Heights conversion",    type: "EMAIL",     priority: "CRITICAL", status: "PENDING",     ownerId: james.id,   opportunityId: opps[7].id,  dueDate: d(3) },
        { organizationId: O, title: "Schedule showing with Natalie Pressman — property management", type: "MEETING",   priority: "MEDIUM",   status: "PENDING",     ownerId: rachel.id,  leadId: leads[5].id,        dueDate: d(1) },
        { organizationId: O, title: "Prepare competitive analysis for Meridian DC deal",             type: "OTHER",     priority: "HIGH",     status: "PENDING",     ownerId: emma.id,    opportunityId: opps[8].id,  dueDate: d(4) },
        // COMPLETED
        { organizationId: O, title: "Send NDA to MetroNest Urban Living",                            type: "EMAIL",     priority: "MEDIUM",   status: "COMPLETED",   ownerId: james.id,   opportunityId: opps[7].id,  dueDate: d(7),  completedAt: d(6) },
        { organizationId: O, title: "Qualification call with Diana Coastal — Kiawah project",        type: "CALL",      priority: "HIGH",     status: "COMPLETED",   ownerId: alex.id,    leadId: leads[17].id,       dueDate: d(5),  completedAt: d(5) },
        { organizationId: O, title: "Investment presentation for Palmetto Capital team",             type: "MEETING",   priority: "HIGH",     status: "COMPLETED",   ownerId: emma.id,    opportunityId: opps[12].id, dueDate: d(15), completedAt: d(14) },
        { organizationId: O, title: "Update CRM with Evergreen property notes",                      type: "OTHER",     priority: "LOW",      status: "COMPLETED",   ownerId: alex.id,    leadId: leads[23].id,       dueDate: d(12), completedAt: d(11) },
        // IN_PROGRESS
        { organizationId: O, title: "Finalize pricing for Palmetto Savannah portfolio deal",         type: "OTHER",     priority: "CRITICAL", status: "IN_PROGRESS", ownerId: emma.id,    opportunityId: opps[10].id, dueDate: future(1) },
        { organizationId: O, title: "Draft Summit Peak implementation timeline",                     type: "OTHER",     priority: "HIGH",     status: "IN_PROGRESS", ownerId: emma.id,    opportunityId: opps[6].id,  dueDate: future(2) },
        { organizationId: O, title: "Qualify lead Sophia Goldstein — Gold Coast Luxury",             type: "CALL",      priority: "MEDIUM",   status: "IN_PROGRESS", ownerId: alex.id,    leadId: leads[16].id,       dueDate: future(1) },
        { organizationId: O, title: "Prepare contract for Palmetto Savannah portfolio",              type: "OTHER",     priority: "HIGH",     status: "PENDING",     ownerId: emma.id,    opportunityId: opps[10].id, dueDate: future(3) },
        { organizationId: O, title: "Send LinkedIn message to Benjamin Crawford — Blue Sky Land",    type: "EMAIL",     priority: "LOW",      status: "PENDING",     ownerId: rachel.id,  leadId: leads[3].id,        dueDate: future(6) },
        { organizationId: O, title: "Coordinate site visit for MetroNest Brooklyn evaluation",       type: "CALL",      priority: "HIGH",     status: "IN_PROGRESS", ownerId: james.id,   opportunityId: opps[7].id,  dueDate: future(2) },
      ],
    });

    // ─── Meetings (10) ──────────────────────────────────────────────
    await prisma.meeting.createMany({
      data: [
        { organizationId: O, title: "Site visit — Palmetto Capital Savannah portfolio",          ownerId: emma.id,   contactId: ctCatherinePalm.id,  leadId: leads[11].id,              startTime: d(10, 9),     endTime: d(10, 10),     location: "Savannah, GA — Historic District",           notes: "Catherine confirmed fund allocation for Q2. Wants full due diligence before board presentation.",   attendees: JSON.stringify(["Catherine Palmer", "Jessica Hartley"]) },
        { organizationId: O, title: "Silverstone office campus walkthrough",                     ownerId: james.id,  contactId: ctMarcusSilver.id,   opportunityId: opps[3].id,         startTime: d(5, 14),     endTime: d(5, 16),      location: "Reston, VA — 1500 Innovation Dr",            notes: "Marcus impressed with building quality. Wants formal LOI by Friday. Legal team needs environmental review.", attendees: JSON.stringify(["Marcus Silverstein", "Steve Chambers"]) },
        { organizationId: O, title: "Q1 pipeline review — sales leadership",                    ownerId: mike.id,   contactId: ctCatherinePalm.id,                                      startTime: d(3, 10),     endTime: d(3, 12),      location: "Aexion Core HQ — Conference Room B",       notes: "Pipeline strong at $47M. Focus on converting Offer-stage deals. Need comp data for 2 properties.",  attendees: JSON.stringify(["Alexandre Henrique", "Kim Sangawa", "Emma Blackwell", "James Whitfield"]) },
        { organizationId: O, title: "Summit Peak stakeholder alignment — Charleston",           ownerId: emma.id,   contactId: ctJamesSummit.id,    opportunityId: opps[6].id,         startTime: d(7, 11),     endTime: d(7, 12),      location: "Virtual — Zoom",                             notes: "James aligned with investment committee. Environmental review of waterfront site next week.",        attendees: JSON.stringify(["James Thornton", "Diana Okafor"]) },
        { organizationId: O, title: "Meridian DC — office building inspection",                  ownerId: emma.id,   contactId: ctThomasMerid.id,    opportunityId: opps[8].id,         startTime: d(4, 13),     endTime: d(4, 15),      location: "Washington DC — 1600 Pennsylvania Ave NW",   notes: "Thomas impressed with tenant roster. Needs rent roll and 5-year CapEx projections.",                  attendees: JSON.stringify(["Thomas Grant", "Greg Patterson"]) },
        { organizationId: O, title: "MetroNest — Brooklyn Heights site visit planning",          ownerId: james.id,  contactId: ctChrisMetro.id,     opportunityId: opps[7].id,         startTime: future(2, 14),endTime: future(2, 16),  location: "Brooklyn Heights, NYC",                      attendees: JSON.stringify(["Chris Nakamura", "Matt Kaplan"]) },
        { organizationId: O, title: "Coastal Living — Kiawah Island lot tour",                  ownerId: emma.id,   contactId: ctDianaCoast.id,     opportunityId: opps[4].id,         startTime: future(5, 9), endTime: future(5, 12),  location: "Kiawah Island, SC — Ocean Course Community", attendees: JSON.stringify(["Diana Coastal", "Karen O'Brien"]) },
        { organizationId: O, title: "Palmetto Capital — Savannah closing negotiation",          ownerId: emma.id,   contactId: ctCatherinePalm.id,  opportunityId: opps[10].id,        startTime: future(1, 10),endTime: future(1, 11),  location: "Palmetto Capital NYC — 450 Park Ave",        attendees: JSON.stringify(["Catherine Palmer"]) },
        { organizationId: O, title: "Quarterly portfolio review with Silverstone",               ownerId: james.id,  contactId: ctMarcusSilver.id,   opportunityId: opps[11].id,        startTime: future(4, 15),endTime: future(4, 16),  location: "Virtual — Microsoft Teams",                  attendees: JSON.stringify(["Marcus Silverstein", "Steve Chambers"]) },
        { organizationId: O, title: "Discovery call — Natalie Pressman, Prestige PM",           ownerId: rachel.id, contactId: ctNataliePress.id,   leadId: leads[5].id,               startTime: future(3, 11),endTime: future(3, 12),  location: "Virtual — Zoom",                             attendees: JSON.stringify(["Natalie Pressman"]) },
      ],
    });

    // ─── Activities (30) ────────────────────────────────────────────
    await prisma.activity.createMany({
      data: [
        { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Revised pricing for Palmetto Savannah portfolio",     body: "Sent updated pricing with volume discount for the 8-property portfolio. Waiting on Catherine's feedback.",             creatorId: emma.id,    leadId: leads[11].id, opportunityId: opps[10].id, createdAt: d(0, 9) },
        { organizationId: O, type: "CALL",         channel: "phone",    subject: "Qualification call — Natalie Pressman, Prestige PM", body: "45-minute call. Discussed property management tech needs. Strong fit for our platform.",                               creatorId: rachel.id,  leadId: leads[5].id,                              createdAt: d(0, 14) },
        { organizationId: O, type: "NOTE",         channel: "internal", subject: "Champion confirmed — Palmetto Capital",              body: "Catherine Palmer confirmed fund committee approved Q2 allocation for Savannah portfolio. Moving to due diligence.",     creatorId: emma.id,    leadId: leads[11].id,                             createdAt: d(1, 10) },
        { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Follow-up from ICSC conference",                     body: "Kevin Zhang from Skyline Tower requested a meeting after ICSC conference. Hot referral from co-investor.",              creatorId: rachel.id,  leadId: leads[9].id,                              createdAt: d(1, 16) },
        { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: LEAD_INQUIRY -> PROPERTY_TOUR",               body: "Silverstone — 200K SF Office Campus advanced to Property Tour.",                                                        creatorId: james.id,   opportunityId: opps[3].id,                        createdAt: d(2, 11) },
        { organizationId: O, type: "EMAIL",        channel: "email",    subject: "CMA report for Meridian DC office",                  body: "Sent comparable market analysis showing 15% upside potential vs. similar Class A assets in the submarket.",             creatorId: emma.id,    opportunityId: opps[8].id,                        createdAt: d(4, 9) },
        { organizationId: O, type: "MEETING",      channel: "video",    subject: "Summit Peak — Charleston waterfront presentation",   body: "Presented to 6 Summit Peak stakeholders. Strong interest in mixed-use concept. Need environmental clearance docs.",     creatorId: emma.id,    opportunityId: opps[6].id,                        createdAt: d(5, 14) },
        { organizationId: O, type: "CALL",         channel: "phone",    subject: "Pricing negotiation — Palmetto Savannah",            body: "Catherine requested 5% discount for all 8 properties. Counter-offered with 3% discount + management contract.",        creatorId: emma.id,    opportunityId: opps[10].id,                       createdAt: d(5, 10) },
        { organizationId: O, type: "NOTE",         channel: "internal", subject: "Risk flag — Gold Coast Palm Beach deal",             body: "International buyer financing fell through. Need backup buyers for 2 of 3 penthouses within 30 days.",                  creatorId: mike.id,    opportunityId: opps[2].id,                        createdAt: d(6, 15) },
        { organizationId: O, type: "EMAIL",        channel: "email",    subject: "LOI sent for Coastal Living estate portfolio",       body: "Legal reviewed the Hilton Head estate portfolio LOI. Sent to Diana Coastal for review and signature.",                  creatorId: james.id,   opportunityId: opps[9].id,                        createdAt: d(6, 9) },
        { organizationId: O, type: "CALL",         channel: "phone",    subject: "Cold outreach — Robert Westfield, Coral Gables",     body: "First call with Robert. Interested in marketing partnership for new 42-unit luxury condo project.",                     creatorId: alex.id,    leadId: leads[0].id,                              createdAt: d(8, 11) },
        { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Referral intro — Andrew Mitchell, Atlantic Shores",  body: "Andrew was referred by a past client. Beachfront developer looking for sales platform for new project.",                creatorId: rachel.id,  leadId: leads[1].id,                              createdAt: d(8, 16) },
        { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: OFFER_SUBMITTED -> UNDER_CONTRACT",           body: "Meridian — 350K SF Class A Office moved to Under Contract.",                                                            creatorId: emma.id,    opportunityId: opps[8].id,                        createdAt: d(10, 10) },
        { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: UNDER_CONTRACT -> CLOSED_WON",                body: "Silverstone — Industrial Park (Atlanta) closed for $7,200,000.",                                                        creatorId: james.id,   opportunityId: opps[11].id,                       createdAt: d(5, 17) },
        { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: DUE_DILIGENCE -> CLOSED_WON",                 body: "Palmetto Capital — Charlotte Multifamily closed for $15,000,000. 2.1x return.",                                         creatorId: emma.id,    opportunityId: opps[12].id,                       createdAt: d(12, 17) },
        { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Lost deal post-mortem — Evergreen Austin",           body: "Evergreen chose competitor with stronger city council relationship. Lesson: engage earlier on entitlements.",            creatorId: emma.id,                                                       createdAt: d(8, 10) },
        { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: PROPERTY_TOUR -> CLOSED_LOST",                body: "Lakeside Resort — Mountain Lodge lost. Environmental concerns from buyer.",                                              creatorId: james.id,   opportunityId: opps[14].id,                       createdAt: d(15, 10) },
        { organizationId: O, type: "NOTE",         channel: "internal", subject: "Weekly pipeline digest — auto-generated",            body: "Pipeline grew 18% this week. 3 new qualified leads, 2 deals advanced to Under Contract. Total active: $47.8M.",        creatorId: mike.id,                                                       createdAt: d(0, 7) },
        { organizationId: O, type: "MEETING",      channel: "video",    subject: "Monthly pipeline review — leadership",               body: "Pipeline at $47.8M. Focus on closing Savannah and Meridian DC deals. Need comp data for Brooklyn conversion.",         creatorId: mike.id,                                                       createdAt: d(14, 10) },
        { organizationId: O, type: "EMAIL",        channel: "email",    subject: "MetroNest — Brooklyn conversion feasibility study",  body: "Sent detailed feasibility study with phased conversion plan. 85 units across 2 buildings.",                              creatorId: james.id,   opportunityId: opps[7].id,                        createdAt: d(10, 9) },
      ],
    });

    // ─── Inbox Messages (12) ────────────────────────────────────────
    await prisma.inboxMessage.createMany({
      data: [
        { organizationId: O, channel: "EMAIL", sender: "catherine@palmettocapital.com",     subject: "Re: Savannah Portfolio — Final Terms",           body: "Emma, I've reviewed the contract with our fund counsel. A few redlines on the indemnification clause, but we're very close. Can we hop on a call Tuesday to finalize?",    isRead: false, starred: true,  createdAt: d(0, 19) },
        { organizationId: O, channel: "EMAIL", sender: "chris@metronest.com",               subject: "Brooklyn Heights — Timeline Question",           body: "James, can we accelerate the conversion timeline? Our construction crew is available starting next month and we'd like to break ground ASAP.",                              isRead: false, starred: false, createdAt: d(0, 15) },
        { organizationId: O, channel: "EMAIL", sender: "james@summitpeakinvest.com",        subject: "Re: Charleston Mixed-Use Proposal",               body: "Hi Emma, the proposal looks compelling. I'm presenting to our investment committee this Thursday. One question — can we phase the retail buildout separately?",             isRead: false, starred: true,  createdAt: d(0, 7) },
        { organizationId: O, channel: "EMAIL", sender: "diana@coastallivinghomes.com",      subject: "Kiawah Lot Tour Confirmation",                   body: "Emma, confirming the Kiawah lot tour next Thursday. I'll have our landscape architect and civil engineer join. Please bring the site survey and topo maps.",                isRead: true,  starred: false, createdAt: d(1, 10) },
        { organizationId: O, channel: "EMAIL", sender: "marcus@silverstoneproperties.com",  subject: "Missed Call — Phase 2 Leasing",                  body: "James, sorry I missed your call. I wanted to discuss expanding to the second building in the office campus. Can you send Phase 2 lease rates?",                          isRead: false, starred: false, createdAt: d(1, 16) },
        { organizationId: O, channel: "EMAIL", sender: "thomas@meridianreadvisors.com",     subject: "DC Office — Rent Roll Request",                   body: "Emma, our underwriting team needs the full rent roll with lease expiration schedule. Also, can you confirm the CapEx reserve balance?",                                    isRead: true,  starred: false, createdAt: d(2, 9) },
        { organizationId: O, channel: "EMAIL", sender: "kevin@skylinetowergroup.com",       subject: "Brickell Tower — Pre-Sales Interest",             body: "Hi Rachel, great meeting at ICSC. We're launching pre-sales for our 250-unit Brickell tower next quarter. Can you send your marketing platform overview?",                isRead: false, starred: true,  createdAt: d(2, 15) },
        { organizationId: O, channel: "EMAIL", sender: "sophia@goldcoastluxury.com",        subject: "Palm Beach Penthouse Buyers",                     body: "Rachel, I have 3 qualified international buyers interested in the Palm Beach penthouses. What's the current asking price and commission structure?",                     isRead: false, starred: false, createdAt: d(0, 11) },
        { organizationId: O, channel: "EMAIL", sender: "rachel@pinnaclereholdings.com",     subject: "Acquisition Pipeline Discussion",                 body: "Alex, I've reviewed your platform demo. Can we schedule a 45-minute call to discuss how it integrates with our acquisitions workflow?",                                   isRead: false, starred: true,  createdAt: d(1, 9) },
        { organizationId: O, channel: "EMAIL", sender: "andrew@atlanticshoresdev.com",      subject: "Beachfront Sales Platform — Interest",            body: "Alex, a colleague recommended your platform. We're launching 3 beachfront projects this year and need better pipeline visibility. Let's chat this week.",                  isRead: false, starred: true,  createdAt: d(0, 10) },
        { organizationId: O, channel: "EMAIL", sender: "system@aexioncore.com",           subject: "Weekly Pipeline Summary",                         body: "Pipeline grew 18% this week. 3 new qualified leads, 2 deals advanced to Under Contract. Total active pipeline: $47.8M.",                                                   isRead: false, starred: false, createdAt: d(0, 8), category: "SYSTEM" },
        { organizationId: O, channel: "EMAIL", sender: "brian@vistaridgecommunities.com",   subject: "Land Acquisition — Vista Ridge Phase 3",          body: "James, we've confirmed the 120-acre parcel for Phase 3 of Vista Ridge. Can you send the comparable land sale data for Maricopa County?",                                  isRead: false, starred: false, createdAt: d(1, 14) },
      ],
    });

    // ─── Integrations (12) ──────────────────────────────────────────
    await prisma.integration.createMany({
      data: ["Gmail", "Google Calendar", "Outlook", "Slack", "HubSpot", "Salesforce", "Zapier", "Stripe", "Zoom", "Microsoft Teams", "Gong", "LinkedIn Sales Navigator"].map((name) => ({
        organizationId: O, name, slug: name.toLowerCase().replace(/\s+/g, "-"), providerKey: name.toLowerCase().replace(/\s+/g, "-"), status: "DISCONNECTED", healthPercent: 0, eventsReceived: 0, errorCount: 0,
      })),
    });

    // ─── Playbooks (5) ──────────────────────────────────────────────
    const pb1 = await prisma.playbook.create({ data: { organizationId: O, name: "Buyer Discovery Playbook", description: "Initial discovery for luxury real estate buyers and investors", segment: "Luxury", stage: "Lead Inquiry", conversionRate: 68, usage: 234 } });
    const pb2 = await prisma.playbook.create({ data: { organizationId: O, name: "Property Tour Playbook", description: "Best practices for conducting impactful property tours and showings", segment: "All", stage: "Property Tour", conversionRate: 52, usage: 189 } });
    const pb3 = await prisma.playbook.create({ data: { organizationId: O, name: "Offer Negotiation Playbook", description: "Tactics for negotiating real estate offers and counteroffers", segment: "Luxury", stage: "Under Contract", conversionRate: 74, usage: 145 } });
    const pb4 = await prisma.playbook.create({ data: { organizationId: O, name: "Objection Handling — Real Estate", description: "Common buyer/investor objections and proven response frameworks", segment: "All", stage: "Property Tour", conversionRate: 61, usage: 312 } });
    const pb5 = await prisma.playbook.create({ data: { organizationId: O, name: "Closing Playbook", description: "Driving real estate transactions to close — inspections, appraisals, financing", segment: "Luxury", stage: "Due Diligence", conversionRate: 78, usage: 167 } });

    await prisma.playbookStep.createMany({
      data: [
        { playbookId: pb1.id, order: 1, title: "Research the buyer/investor", description: "Review LinkedIn, investment history, portfolio, and recent acquisitions before the call." },
        { playbookId: pb1.id, order: 2, title: "Open with market insight", description: "Start with a relevant market trend or comparable sale to establish expertise." },
        { playbookId: pb1.id, order: 3, title: "Uncover investment criteria", description: "Identify target property type, location, budget, timeline, and return expectations." },
        { playbookId: pb1.id, order: 4, title: "Qualify financial readiness", description: "Confirm proof of funds, financing pre-approval, and decision-making authority." },
        { playbookId: pb1.id, order: 5, title: "Set next steps", description: "Schedule a property tour or send curated property recommendations." },
        { playbookId: pb2.id, order: 1, title: "Confirm tour logistics", description: "Send tour details 24h before. Confirm addresses, access codes, and attendees." },
        { playbookId: pb2.id, order: 2, title: "Prepare market comparables", description: "Have CMA for each property showing recent comparable sales within 0.5 miles." },
        { playbookId: pb2.id, order: 3, title: "Lead with lifestyle, not features", description: "Paint the picture of living/investing in the property, not just specs." },
        { playbookId: pb2.id, order: 4, title: "Address concerns proactively", description: "If you know about issues (noise, HOA fees, repairs), address them first." },
        { playbookId: pb2.id, order: 5, title: "Close with urgency", description: "Share market velocity data — days on market, competing offers, price trends." },
        { playbookId: pb3.id, order: 1, title: "Establish property value first", description: "Present CMA and investment analysis before discussing price." },
        { playbookId: pb3.id, order: 2, title: "Understand the other side", description: "Research seller's motivation, timeline, and competing offers." },
        { playbookId: pb3.id, order: 3, title: "Create a mutual timeline", description: "Build a shared closing calendar with inspection, appraisal, and financing milestones." },
        { playbookId: pb3.id, order: 4, title: "Negotiate terms, not just price", description: "Trade concessions on closing costs, inspection credits, and closing date flexibility." },
        { playbookId: pb4.id, order: 1, title: "Listen fully", description: "Let the buyer/investor express their concern completely before responding." },
        { playbookId: pb4.id, order: 2, title: "Clarify the real objection", description: "Ask probing questions — is it really price, or is it fear of overpaying?" },
        { playbookId: pb4.id, order: 3, title: "Respond with data", description: "Use comparable sales, market trends, and ROI projections to address the objection." },
        { playbookId: pb4.id, order: 4, title: "Confirm resolution", description: "Ask if the concern has been addressed and if there are other blockers." },
        { playbookId: pb5.id, order: 1, title: "Confirm all parties aligned", description: "Ensure buyer, seller, attorneys, and lenders are all on the same page." },
        { playbookId: pb5.id, order: 2, title: "Manage inspection & appraisal", description: "Coordinate inspections, negotiate repairs, and manage appraisal contingencies." },
        { playbookId: pb5.id, order: 3, title: "Clear title & financing", description: "Monitor title search, ensure clear title, and track loan approval progress." },
        { playbookId: pb5.id, order: 4, title: "Execute closing", description: "Coordinate final walkthrough, wire instructions, and closing documents signing." },
      ],
    });

    // ─── Insights (8) ───────────────────────────────────────────────
    await prisma.insight.createMany({
      data: [
        { organizationId: O, category: "pipeline",   title: "High-value deals stalling in Under Contract",    description: "2 deals worth $18.8M combined have been Under Contract for over 10 days without activity update.",                        impact: "HIGH",   confidence: 92, suggestedAction: "Schedule status calls for Meridian DC and Coastal Living deals this week.",      opportunityId: opps[8].id },
        { organizationId: O, category: "engagement", title: "Lead response time improving",                   description: "Average lead response time dropped 32% this month, from 4.1 hours to 2.8 hours.",                                        impact: "MEDIUM", confidence: 87, suggestedAction: "Maintain current cadence. Share Alex's response templates with the team." },
        { organizationId: O, category: "risk",        title: "MetroNest Brooklyn deal at risk",                description: "MetroNest requesting additional zoning documentation. Deal may stall without city planning confirmation within 1 week.",  impact: "HIGH",   confidence: 95, suggestedAction: "Expedite zoning confirmation and line up reference projects this week.",          opportunityId: opps[7].id },
        { organizationId: O, category: "performance", title: "Top performer: Emma Blackwell",                  description: "Emma closed $22.2M this quarter with a 67% win rate. Highest volume on luxury development deals.",                      impact: "LOW",    confidence: 98, suggestedAction: "Schedule knowledge-sharing session with the team." },
        { organizationId: O, category: "pipeline",   title: "Pipeline concentration risk — Palmetto Capital",  description: "35% of active pipeline value is concentrated in Palmetto Capital deals.",                                                 impact: "HIGH",   confidence: 90, suggestedAction: "Accelerate prospecting to diversify across 3+ new investor relationships.",       leadId: leads[11].id },
        { organizationId: O, category: "engagement", title: "Cold leads without re-engagement",               description: "5 leads with COLD temperature have not been contacted in over 15 days.",                                                 impact: "MEDIUM", confidence: 85, suggestedAction: "Launch automated market update emails for cold leads." },
        { organizationId: O, category: "conversion", title: "Tour-to-Offer conversion trending up",           description: "Property Tour to Offer Submitted conversion rate increased from 38% to 52% over the last 30 days.",                     impact: "MEDIUM", confidence: 88, suggestedAction: "Document the improved tour presentation for team training." },
        { organizationId: O, category: "risk",        title: "Summit Peak — competitive threat",                description: "Competing developer offering seller financing on Charleston waterfront site. Summit Peak evaluating both options.",        impact: "HIGH",   confidence: 91, suggestedAction: "Emphasize our development track record and faster closing timeline.",              opportunityId: opps[6].id },
      ],
    });

    // ─── Recommendations (5) ────────────────────────────────────────
    await prisma.recommendation.createMany({
      data: [
        { organizationId: O, action: "Schedule executive call for Meridian DC office deal",             reason: "$12M deal Under Contract for 10+ days. Executive alignment can accelerate closing.",                               priority: "HIGH",     opportunityId: opps[8].id },
        { organizationId: O, action: "Send Palmetto case study to Summit Peak investment committee",    reason: "Summit Peak evaluating competitors. Showing similar portfolio win strengthens our position.",                      priority: "MEDIUM",   leadId: leads[18].id },
        { organizationId: O, action: "Re-engage cold leads with Q2 market report",                      reason: "5 cold leads inactive 15+ days. Quarterly market report can reactivate 2-3 conversations.",                      priority: "LOW" },
        { organizationId: O, action: "Prepare counter-proposal for MetroNest Brooklyn conversion",      reason: "MetroNest requested timeline acceleration. Without updated proposal in 3 days, $5.2M deal may stall.",            priority: "CRITICAL", opportunityId: opps[7].id },
        { organizationId: O, action: "Schedule QBR with Silverstone to discuss Phase 2 leasing",        reason: "Atlanta industrial deal closed successfully. Phase 2 office leasing could be a $4.5M+ opportunity.",              priority: "HIGH",     opportunityId: opps[11].id },
      ],
    });

    // ─── Forecast Snapshots ─────────────────────────────────────────
    await prisma.forecastSnapshot.createMany({
      data: [
        { organizationId: O, quarter: "Q1", year: 2026, commit: 22200000, bestCase: 35000000, pipeline: 65000000, target: 25000000 },
        { organizationId: O, quarter: "Q2", year: 2026, commit: 28500000, bestCase: 48000000, pipeline: 80000000, target: 30000000 },
        { organizationId: O, quarter: "Q3", year: 2026, commit: 0,        bestCase: 15000000, pipeline: 35000000, target: 30000000 },
      ],
    });

    // ─── Audit Logs ─────────────────────────────────────────────────
    await prisma.auditLog.createMany({
      data: [
        { organizationId: O, userId: emma.id,        action: "opportunity.closed_won",   objectType: "Opportunity", objectId: opps[12].id, details: "Palmetto Capital — Charlotte Multifamily closed for $15,000,000", source: "web", createdAt: d(5) },
        { organizationId: O, userId: james.id,       action: "opportunity.closed_won",   objectType: "Opportunity", objectId: opps[11].id, details: "Silverstone — Industrial Park (Atlanta) closed for $7,200,000",   source: "web", createdAt: d(12) },
        { organizationId: O, userId: alex.id,        action: "lead.status_changed",      objectType: "Lead",        objectId: leads[11].id,details: "Status changed from CONTACTED to QUALIFIED",                       source: "web", createdAt: d(15) },
        { organizationId: O, userId: rachel.id,      action: "lead.status_changed",      objectType: "Lead",        objectId: leads[12].id,details: "Status changed from NEW to QUALIFIED",                             source: "web", createdAt: d(18) },
        { organizationId: O, userId: aexionAdmin.id, action: "settings.modules_updated", objectType: "Organization", objectId: org.id,     details: "Enabled modules: commercial, data, reports, automation, post_sale, playbooks", source: "admin", createdAt: d(30) },
      ],
    });

    return Response.json({
      success: true,
      message: "Database seeded with US Real Estate demo data",
      summary: {
        organization: "Aexion Core",
        teams: 4,
        users: 7,
        companies: 20,
        contacts: 30,
        leads: 25,
        accounts: 8,
        opportunities: 15,
        tasks: 20,
        meetings: 10,
        activities: 20,
        inboxMessages: 12,
        integrations: 12,
        playbooks: 5,
        insights: 8,
        recommendations: 5,
      },
      credentials: {
        admin: { email: "admin@aexioncore.com", password: "aexion123", name: "Thiago Pio" },
        demo: [
          { email: "kim@aexioncore.com", password: "demo123", role: "ADMIN", name: "Kim Sangawa" },
          { email: "alexandre@aexioncore.com", password: "demo123", role: "ADMIN", name: "Alexandre Henrique" },
          { email: "emma@aexioncore.com", password: "demo123", role: "CLOSER" },
          { email: "james@aexioncore.com", password: "demo123", role: "CLOSER" },
          { email: "alex@aexioncore.com", password: "demo123", role: "SDR" },
          { email: "rachel@aexioncore.com", password: "demo123", role: "SDR" },
        ],
      },
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return Response.json({ error: error.message || "Seed failed" }, { status: 500 });
  }
}
