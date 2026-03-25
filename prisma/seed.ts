import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Date Helpers ─────────────────────────────────────────────────────────────
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

async function main() {
  console.log("Starting US B2B SaaS Demo seed...");

  // ─── Clear ──────────────────────────────────────────────────────────────────
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

  // ─── Organization ─────────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: "Aexion Demo Corp",
      slug: "aexion-demo",
      displayName: "Aexion Demo Corp",
      industry: "SaaS / Technology",
      defaultCurrency: "USD",
      timezone: "America/New_York",
      setupCompleted: true,
      setupStep: 5,
      enabledModules: JSON.stringify(["commercial", "data", "reports", "automation", "post_sale", "playbooks"]),
    },
  });
  const O = org.id;

  // ─── Teams (4) ────────────────────────────────────────────────────────────
  const sdrTeam = await prisma.team.create({ data: { organizationId: O, name: "Sales Development", description: "Prospecting, outbound outreach, and lead qualification" } });
  const closerTeam = await prisma.team.create({ data: { organizationId: O, name: "Enterprise Sales", description: "Deal management, demos, and closing enterprise accounts" } });
  const mgrTeam = await prisma.team.create({ data: { organizationId: O, name: "Sales Leadership", description: "Sales strategy, coaching, and pipeline management" } });
  const execTeam = await prisma.team.create({ data: { organizationId: O, name: "Executive Team", description: "Executive leadership and strategic direction" } });

  // ─── Users (7) ────────────────────────────────────────────────────────────
  const adminPw = await bcrypt.hash("aexion123", 10);
  const demoPw = await bcrypt.hash("demo123", 10);
  const mkUser = (email: string, name: string, role: string, workspace: string, teamId: string, password: string) =>
    prisma.user.create({ data: { organizationId: O, teamId, email, name, password, role, workspace, isActive: true } });

  const aexionAdmin = await mkUser("aexion@aexioncore.com",          "Aexion Admin",      "ADMIN",   "EXECUTIVE", execTeam.id, adminPw);
  const sarah       = await mkUser("sarah.chen@aexiondemo.com",      "Sarah Chen",        "ADMIN",   "EXECUTIVE", execTeam.id, demoPw);
  const mike        = await mkUser("mike.johnson@aexiondemo.com",    "Mike Johnson",      "MANAGER", "MANAGER",   mgrTeam.id,  demoPw);
  const emma        = await mkUser("emma.williams@aexiondemo.com",   "Emma Williams",     "CLOSER",  "CLOSER",    closerTeam.id, demoPw);
  const james       = await mkUser("james.rodriguez@aexiondemo.com", "James Rodriguez",   "CLOSER",  "CLOSER",    closerTeam.id, demoPw);
  const alex        = await mkUser("alex.kim@aexiondemo.com",        "Alex Kim",          "SDR",     "SDR",        sdrTeam.id,  demoPw);
  const rachel      = await mkUser("rachel.nguyen@aexiondemo.com",   "Rachel Nguyen",     "SDR",     "SDR",        sdrTeam.id,  demoPw);

  // Set team managers
  await prisma.team.update({ where: { id: sdrTeam.id }, data: { managerId: mike.id } });
  await prisma.team.update({ where: { id: closerTeam.id }, data: { managerId: mike.id } });
  await prisma.team.update({ where: { id: mgrTeam.id }, data: { managerId: sarah.id } });
  await prisma.team.update({ where: { id: execTeam.id }, data: { managerId: sarah.id } });

  // ─── Companies (20) — US tech/enterprise companies ─────────────────────────
  const mkCo = (name: string, industry: string, size: string, website: string, annualRevenue?: number) =>
    prisma.company.create({ data: { organizationId: O, name, industry, size, website, annualRevenue } });

  const coTechCorp   = await mkCo("TechCorp Solutions",          "Enterprise Software",         "201-500",    "https://techcorpsolutions.com",     85000000);
  const coMeridian   = await mkCo("Meridian Health Systems",     "Healthcare Technology",       "1001-5000",  "https://meridianhealthsys.com",     420000000);
  const coAtlas      = await mkCo("Atlas Financial Group",       "Financial Services",          "501-1000",   "https://atlasfinancialgroup.com",   310000000);
  const coPinnacle   = await mkCo("Pinnacle Manufacturing",      "Advanced Manufacturing",      "1001-5000",  "https://pinnaclemfg.com",           680000000);
  const coQuantum    = await mkCo("Quantum Data Analytics",      "Data & Analytics",            "51-200",     "https://quantumdataanalytics.com",  28000000);
  const coHorizon    = await mkCo("Horizon Cloud Services",      "Cloud Infrastructure",        "201-500",    "https://horizoncloudservices.com",  95000000);
  const coVelocity   = await mkCo("Velocity Logistics",          "Supply Chain & Logistics",    "501-1000",   "https://velocitylogistics.com",     220000000);
  const coNexGen     = await mkCo("NexGen Cybersecurity",        "Cybersecurity",               "51-200",     "https://nexgencyber.com",           42000000);
  const coBluePeak   = await mkCo("BluePeak Capital",            "Investment Management",       "11-50",      "https://bluepeakcapital.com",       15000000);
  const coSterling   = await mkCo("Sterling Insurance Group",    "Insurance",                   "1001-5000",  "https://sterlinginsurance.com",     520000000);
  const coRedwood    = await mkCo("Redwood Retail Partners",     "Retail & E-Commerce",         "201-500",    "https://redwoodretail.com",         110000000);
  const coSummit     = await mkCo("Summit Education Technologies","EdTech",                     "51-200",     "https://summitedtech.com",          32000000);
  const coCatalyst   = await mkCo("Catalyst Biotech",            "Biotechnology",               "201-500",    "https://catalystbiotech.com",       145000000);
  const coApex       = await mkCo("Apex Media Group",            "Digital Media",               "51-200",     "https://apexmediagroup.com",        55000000);
  const coIronclad   = await mkCo("Ironclad Legal Technologies", "Legal Tech",                  "11-50",      "https://ironcladlegaltech.com",     18000000);
  const coVanguard   = await mkCo("Vanguard Energy Solutions",   "Clean Energy",                "201-500",    "https://vanguardenergy.com",        175000000);
  const coNova       = await mkCo("Nova Telecommunications",     "Telecommunications",          "501-1000",   "https://novatelecom.com",           340000000);
  const coClearPath  = await mkCo("ClearPath Consulting",        "Management Consulting",       "51-200",     "https://clearpathconsulting.com",   38000000);
  const coEvergreen  = await mkCo("Evergreen Property Group",    "Commercial Real Estate",      "201-500",    "https://evergreenpropertygroup.com",210000000);
  const coPrism      = await mkCo("Prism AI Labs",              "Artificial Intelligence",     "11-50",      "https://prismailabs.com",           12000000);

  // ─── Contacts (35) ────────────────────────────────────────────────────────
  const mkContact = (name: string, email: string, title: string, companyId: string, phone?: string, isDecisionMaker = false, isChampion = false) =>
    prisma.contact.create({ data: { organizationId: O, name, email, title, companyId, phone, isDecisionMaker, isChampion } });

  const ctDavidChen        = await mkContact("David Chen",         "david.chen@techcorpsolutions.com",         "CTO",                              coTechCorp.id,   "(415) 555-0142", true,  false);
  const ctLisaPark         = await mkContact("Lisa Park",          "lisa.park@techcorpsolutions.com",          "VP of Engineering",                coTechCorp.id,   "(415) 555-0198", false, true);
  const ctMarkThompson     = await mkContact("Mark Thompson",      "mark.thompson@meridianhealthsys.com",     "Chief Digital Officer",            coMeridian.id,   "(312) 555-0234", true,  false);
  const ctJenBaker         = await mkContact("Jennifer Baker",     "jennifer.baker@meridianhealthsys.com",    "Director of IT",                   coMeridian.id,   "(312) 555-0267", false, true);
  const ctRyanOConnor      = await mkContact("Ryan O'Connor",      "ryan.oconnor@atlasfinancialgroup.com",    "CFO",                              coAtlas.id,      "(212) 555-0311", true,  true);
  const ctAmandaLee        = await mkContact("Amanda Lee",         "amanda.lee@pinnaclemfg.com",              "VP of Operations",                 coPinnacle.id,   "(313) 555-0445", true,  false);
  const ctBrianMiller      = await mkContact("Brian Miller",       "brian.miller@pinnaclemfg.com",            "Director of Supply Chain",         coPinnacle.id,   "(313) 555-0478", false, true);
  const ctNatalieWu        = await mkContact("Natalie Wu",         "natalie.wu@quantumdataanalytics.com",     "CEO",                              coQuantum.id,    "(650) 555-0523", true,  true);
  const ctChrisDavis       = await mkContact("Chris Davis",        "chris.davis@horizoncloudservices.com",    "VP of Product",                    coHorizon.id,    "(206) 555-0612", true,  false);
  const ctKarenJohnson     = await mkContact("Karen Johnson",      "karen.johnson@horizoncloudservices.com",  "Head of Partnerships",             coHorizon.id,    "(206) 555-0634", false, true);
  const ctTomWilson        = await mkContact("Tom Wilson",         "tom.wilson@velocitylogistics.com",        "COO",                              coVelocity.id,   "(972) 555-0789", true,  false);
  const ctSophiaGarcia     = await mkContact("Sophia Garcia",      "sophia.garcia@nexgencyber.com",           "CTO",                              coNexGen.id,     "(703) 555-0845", true,  true);
  const ctDanielKim        = await mkContact("Daniel Kim",         "daniel.kim@bluepeakcapital.com",          "Managing Partner",                 coBluePeak.id,   "(212) 555-0923", true,  false);
  const ctEmilyBrown       = await mkContact("Emily Brown",        "emily.brown@sterlinginsurance.com",       "SVP of Technology",                coSterling.id,   "(860) 555-1034", true,  false);
  const ctJasonTaylor      = await mkContact("Jason Taylor",       "jason.taylor@sterlinginsurance.com",      "Director of Digital Transformation", coSterling.id, "(860) 555-1067", false, true);
  const ctMichelleRobinson = await mkContact("Michelle Robinson",  "michelle.robinson@redwoodretail.com",     "VP of E-Commerce",                 coRedwood.id,    "(503) 555-1145", true,  false);
  const ctAndrewScott      = await mkContact("Andrew Scott",       "andrew.scott@summitedtech.com",           "CEO",                              coSummit.id,     "(512) 555-1234", true,  true);
  const ctLauraAdams       = await mkContact("Laura Adams",        "laura.adams@catalystbiotech.com",         "Chief Information Officer",        coCatalyst.id,   "(858) 555-1356", true,  false);
  const ctKevinMartinez    = await mkContact("Kevin Martinez",     "kevin.martinez@apexmediagroup.com",       "VP of Revenue Operations",         coApex.id,       "(310) 555-1478", true,  true);
  const ctRachelClark      = await mkContact("Rachel Clark",       "rachel.clark@ironcladlegaltech.com",      "CEO",                              coIronclad.id,   "(617) 555-1523", true,  true);
  const ctPaulHarris       = await mkContact("Paul Harris",        "paul.harris@vanguardenergy.com",          "Director of Technology",           coVanguard.id,   "(720) 555-1634", false, true);
  const ctJessicaLewis     = await mkContact("Jessica Lewis",      "jessica.lewis@vanguardenergy.com",        "VP of Strategy",                   coVanguard.id,   "(720) 555-1667", true,  false);
  const ctMattWalker       = await mkContact("Matt Walker",        "matt.walker@novatelecom.com",             "SVP of Enterprise",                coNova.id,       "(404) 555-1789", true,  false);
  const ctSarahHall        = await mkContact("Sarah Hall",         "sarah.hall@novatelecom.com",              "Director of Procurement",          coNova.id,       "(404) 555-1812", false, true);
  const ctBenThomas        = await mkContact("Ben Thomas",         "ben.thomas@clearpathconsulting.com",      "Managing Director",                coClearPath.id,  "(202) 555-1934", true,  false);
  const ctLindsayWhite     = await mkContact("Lindsay White",      "lindsay.white@evergreenpropertygroup.com","VP of Operations",                 coEvergreen.id,  "(305) 555-2045", true,  false);
  const ctNickJackson      = await mkContact("Nick Jackson",       "nick.jackson@prismailabs.com",            "CTO",                              coPrism.id,      "(415) 555-2134", true,  true);
  const ctAliceMoore       = await mkContact("Alice Moore",        "alice.moore@atlasfinancialgroup.com",     "Director of Analytics",            coAtlas.id,      "(212) 555-2245", false, false);
  const ctSteveMartin      = await mkContact("Steve Martin",       "steve.martin@pinnaclemfg.com",            "IT Manager",                       coPinnacle.id,   "(313) 555-2356", false, false);
  const ctDianaRoss        = await mkContact("Diana Ross",         "diana.ross@meridianhealthsys.com",        "VP of Compliance",                 coMeridian.id,   "(312) 555-2467", false, false);
  const ctGregAnderson     = await mkContact("Greg Anderson",      "greg.anderson@velocitylogistics.com",     "CTO",                              coVelocity.id,   "(972) 555-2578", true,  false);
  const ctHeatherYoung     = await mkContact("Heather Young",      "heather.young@sterlinginsurance.com",     "Project Manager",                  coSterling.id,   "(860) 555-2689", false, false);
  const ctPatrickKing      = await mkContact("Patrick King",       "patrick.king@redwoodretail.com",          "Director of IT",                   coRedwood.id,    "(503) 555-2790", false, true);
  const ctCourtneyCarter   = await mkContact("Courtney Carter",    "courtney.carter@nexgencyber.com",         "VP of Sales",                      coNexGen.id,     "(703) 555-2891", false, false);
  const ctTylerReed        = await mkContact("Tyler Reed",         "tyler.reed@catalystbiotech.com",          "Director of R&D Systems",          coCatalyst.id,   "(858) 555-2934", false, false);

  // ─── Leads (25) — owned by SDRs (Alex & Rachel) ───────────────────────────
  const mkLead = (p: { name: string; email: string; phone?: string; title?: string; companyId: string; contactId: string; ownerId: string; source: string; status: string; temperature: string; fitScore: number; lastContact?: Date }) =>
    prisma.lead.create({ data: { organizationId: O, ...p } });

  const leads: Awaited<ReturnType<typeof mkLead>>[] = [];
  // NEW (5)
  leads.push(await mkLead({ name: "David Chen",          email: "david.chen@techcorpsolutions.com",         phone: "(415) 555-0142", title: "CTO",                          companyId: coTechCorp.id,    contactId: ctDavidChen.id,        ownerId: alex.id,    source: "WEBSITE",        status: "NEW",          temperature: "WARM",  fitScore: 72 }));
  leads.push(await mkLead({ name: "Nick Jackson",        email: "nick.jackson@prismailabs.com",             phone: "(415) 555-2134", title: "CTO",                          companyId: coPrism.id,       contactId: ctNickJackson.id,      ownerId: rachel.id,  source: "REFERRAL",       status: "NEW",          temperature: "HOT",   fitScore: 88 }));
  leads.push(await mkLead({ name: "Lindsay White",       email: "lindsay.white@evergreenpropertygroup.com", phone: "(305) 555-2045", title: "VP of Operations",             companyId: coEvergreen.id,   contactId: ctLindsayWhite.id,     ownerId: alex.id,    source: "LINKEDIN",       status: "NEW",          temperature: "COLD",  fitScore: 45 }));
  leads.push(await mkLead({ name: "Ben Thomas",          email: "ben.thomas@clearpathconsulting.com",       phone: "(202) 555-1934", title: "Managing Director",            companyId: coClearPath.id,   contactId: ctBenThomas.id,        ownerId: rachel.id,  source: "EVENT",          status: "NEW",          temperature: "WARM",  fitScore: 63 }));
  leads.push(await mkLead({ name: "Courtney Carter",     email: "courtney.carter@nexgencyber.com",          phone: "(703) 555-2891", title: "VP of Sales",                  companyId: coNexGen.id,      contactId: ctCourtneyCarter.id,   ownerId: alex.id,    source: "COLD_OUTBOUND",  status: "NEW",          temperature: "COLD",  fitScore: 38 }));
  // CONTACTED (6)
  leads.push(await mkLead({ name: "Natalie Wu",          email: "natalie.wu@quantumdataanalytics.com",      phone: "(650) 555-0523", title: "CEO",                          companyId: coQuantum.id,     contactId: ctNatalieWu.id,        ownerId: rachel.id,  source: "LINKEDIN",       status: "CONTACTED",    temperature: "WARM",  fitScore: 78, lastContact: d(3) }));
  leads.push(await mkLead({ name: "Andrew Scott",        email: "andrew.scott@summitedtech.com",            phone: "(512) 555-1234", title: "CEO",                          companyId: coSummit.id,      contactId: ctAndrewScott.id,      ownerId: alex.id,    source: "WEBSITE",        status: "CONTACTED",    temperature: "WARM",  fitScore: 70, lastContact: d(5) }));
  leads.push(await mkLead({ name: "Paul Harris",         email: "paul.harris@vanguardenergy.com",           phone: "(720) 555-1634", title: "Director of Technology",       companyId: coVanguard.id,    contactId: ctPaulHarris.id,       ownerId: rachel.id,  source: "PARTNER",        status: "CONTACTED",    temperature: "WARM",  fitScore: 74, lastContact: d(2) }));
  leads.push(await mkLead({ name: "Patrick King",        email: "patrick.king@redwoodretail.com",           phone: "(503) 555-2790", title: "Director of IT",               companyId: coRedwood.id,     contactId: ctPatrickKing.id,      ownerId: alex.id,    source: "EVENT",          status: "CONTACTED",    temperature: "HOT",   fitScore: 82, lastContact: d(1) }));
  leads.push(await mkLead({ name: "Kevin Martinez",      email: "kevin.martinez@apexmediagroup.com",        phone: "(310) 555-1478", title: "VP of Revenue Operations",     companyId: coApex.id,        contactId: ctKevinMartinez.id,    ownerId: rachel.id,  source: "REFERRAL",       status: "CONTACTED",    temperature: "HOT",   fitScore: 85, lastContact: d(1) }));
  leads.push(await mkLead({ name: "Brian Miller",        email: "brian.miller@pinnaclemfg.com",             phone: "(313) 555-0478", title: "Director of Supply Chain",     companyId: coPinnacle.id,    contactId: ctBrianMiller.id,      ownerId: alex.id,    source: "LINKEDIN",       status: "CONTACTED",    temperature: "WARM",  fitScore: 68, lastContact: d(7) }));
  // QUALIFIED (5)
  leads.push(await mkLead({ name: "Ryan O'Connor",       email: "ryan.oconnor@atlasfinancialgroup.com",     phone: "(212) 555-0311", title: "CFO",                          companyId: coAtlas.id,       contactId: ctRyanOConnor.id,      ownerId: alex.id,    source: "REFERRAL",       status: "QUALIFIED",    temperature: "HOT",   fitScore: 95, lastContact: d(1) }));
  leads.push(await mkLead({ name: "Mark Thompson",       email: "mark.thompson@meridianhealthsys.com",      phone: "(312) 555-0234", title: "Chief Digital Officer",        companyId: coMeridian.id,    contactId: ctMarkThompson.id,     ownerId: rachel.id,  source: "EVENT",          status: "QUALIFIED",    temperature: "HOT",   fitScore: 92, lastContact: d(2) }));
  leads.push(await mkLead({ name: "Rachel Clark",        email: "rachel.clark@ironcladlegaltech.com",       phone: "(617) 555-1523", title: "CEO",                          companyId: coIronclad.id,    contactId: ctRachelClark.id,      ownerId: alex.id,    source: "WEBSITE",        status: "QUALIFIED",    temperature: "HOT",   fitScore: 88, lastContact: d(1) }));
  leads.push(await mkLead({ name: "Jessica Lewis",       email: "jessica.lewis@vanguardenergy.com",         phone: "(720) 555-1667", title: "VP of Strategy",               companyId: coVanguard.id,    contactId: ctJessicaLewis.id,     ownerId: rachel.id,  source: "PARTNER",        status: "QUALIFIED",    temperature: "WARM",  fitScore: 80, lastContact: d(4) }));
  leads.push(await mkLead({ name: "Sophia Garcia",       email: "sophia.garcia@nexgencyber.com",            phone: "(703) 555-0845", title: "CTO",                          companyId: coNexGen.id,      contactId: ctSophiaGarcia.id,     ownerId: alex.id,    source: "LINKEDIN",       status: "QUALIFIED",    temperature: "WARM",  fitScore: 76, lastContact: d(3) }));
  // CONVERTED (4)
  leads.push(await mkLead({ name: "Amanda Lee",          email: "amanda.lee@pinnaclemfg.com",               phone: "(313) 555-0445", title: "VP of Operations",             companyId: coPinnacle.id,    contactId: ctAmandaLee.id,        ownerId: alex.id,    source: "LINKEDIN",       status: "CONVERTED",    temperature: "HOT",   fitScore: 94, lastContact: d(12) }));
  leads.push(await mkLead({ name: "Emily Brown",         email: "emily.brown@sterlinginsurance.com",        phone: "(860) 555-1034", title: "SVP of Technology",            companyId: coSterling.id,    contactId: ctEmilyBrown.id,       ownerId: rachel.id,  source: "EVENT",          status: "CONVERTED",    temperature: "HOT",   fitScore: 90, lastContact: d(18) }));
  leads.push(await mkLead({ name: "Matt Walker",         email: "matt.walker@novatelecom.com",              phone: "(404) 555-1789", title: "SVP of Enterprise",            companyId: coNova.id,        contactId: ctMattWalker.id,       ownerId: alex.id,    source: "REFERRAL",       status: "CONVERTED",    temperature: "HOT",   fitScore: 91, lastContact: d(15) }));
  leads.push(await mkLead({ name: "Tom Wilson",          email: "tom.wilson@velocitylogistics.com",         phone: "(972) 555-0789", title: "COO",                          companyId: coVelocity.id,    contactId: ctTomWilson.id,        ownerId: rachel.id,  source: "COLD_OUTBOUND",  status: "CONVERTED",    temperature: "WARM",  fitScore: 83, lastContact: d(20) }));
  // DISQUALIFIED (3)
  leads.push(await mkLead({ name: "Steve Martin",        email: "steve.martin@pinnaclemfg.com",             phone: "(313) 555-2356", title: "IT Manager",                   companyId: coPinnacle.id,    contactId: ctSteveMartin.id,      ownerId: rachel.id,  source: "WEBSITE",        status: "DISQUALIFIED", temperature: "COLD",  fitScore: 22 }));
  leads.push(await mkLead({ name: "Heather Young",       email: "heather.young@sterlinginsurance.com",      phone: "(860) 555-2689", title: "Project Manager",              companyId: coSterling.id,    contactId: ctHeatherYoung.id,     ownerId: alex.id,    source: "COLD_OUTBOUND",  status: "DISQUALIFIED", temperature: "COLD",  fitScore: 18 }));
  leads.push(await mkLead({ name: "Tyler Reed",          email: "tyler.reed@catalystbiotech.com",           phone: "(858) 555-2934", title: "Director of R&D Systems",      companyId: coCatalyst.id,    contactId: ctTylerReed.id,        ownerId: rachel.id,  source: "WEBSITE",        status: "DISQUALIFIED", temperature: "COLD",  fitScore: 30 }));
  // NURTURING (2)
  leads.push(await mkLead({ name: "Michelle Robinson",   email: "michelle.robinson@redwoodretail.com",      phone: "(503) 555-1145", title: "VP of E-Commerce",             companyId: coRedwood.id,     contactId: ctMichelleRobinson.id, ownerId: alex.id,    source: "EVENT",          status: "NURTURING",    temperature: "WARM",  fitScore: 65, lastContact: d(10) }));
  leads.push(await mkLead({ name: "Laura Adams",         email: "laura.adams@catalystbiotech.com",          phone: "(858) 555-1356", title: "Chief Information Officer",    companyId: coCatalyst.id,    contactId: ctLauraAdams.id,       ownerId: rachel.id,  source: "PARTNER",        status: "NURTURING",    temperature: "WARM",  fitScore: 60, lastContact: d(14) }));

  // ─── Accounts (8) — linked to companies ───────────────────────────────────
  const mkAcct = (name: string, companyId: string, ownerId: string, isCustomer = false, becameCustomerAt?: Date, onboardingStatus = "PENDING") =>
    prisma.account.create({ data: { organizationId: O, name, companyId, ownerId, status: "active", isCustomer, becameCustomerAt, onboardingStatus } });

  const acctAtlas     = await mkAcct("Atlas Financial — Enterprise",       coAtlas.id,     emma.id,   true,  d(30), "COMPLETED");
  const acctMeridian  = await mkAcct("Meridian Health — Digital Platform",  coMeridian.id,  james.id,  true,  d(45), "IN_PROGRESS");
  const acctPinnacle  = await mkAcct("Pinnacle Manufacturing — Ops Suite",  coPinnacle.id,  emma.id);
  const acctSterling  = await mkAcct("Sterling Insurance — Platform",       coSterling.id,  james.id);
  const acctNova      = await mkAcct("Nova Telecom — Enterprise",           coNova.id,      emma.id);
  const acctVelocity  = await mkAcct("Velocity Logistics — Supply Chain",   coVelocity.id,  james.id);
  const acctHorizon   = await mkAcct("Horizon Cloud — Partnership",         coHorizon.id,   emma.id);
  const acctVanguard  = await mkAcct("Vanguard Energy — Analytics",         coVanguard.id,  james.id);

  // ─── Pipeline & Stages ────────────────────────────────────────────────────
  const pipeline = await prisma.pipeline.create({ data: { organizationId: O, name: "B2B SaaS Pipeline", description: "Main sales pipeline for enterprise SaaS deals" } });
  const stageData = [
    { name: "Discovery",      order: 1, color: "#3B82F6" },
    { name: "Qualification",  order: 2, color: "#8B5CF6" },
    { name: "Proposal",       order: 3, color: "#F59E0B" },
    { name: "Negotiation",    order: 4, color: "#EF4444" },
    { name: "Verbal Commit",  order: 5, color: "#06B6D4" },
    { name: "Closed Won",     order: 6, color: "#10B981" },
    { name: "Closed Lost",    order: 7, color: "#6B7280" },
  ];
  const stages: Record<string, string> = {};
  for (const s of stageData) {
    const st = await prisma.stage.create({ data: { pipelineId: pipeline.id, ...s } });
    stages[s.name] = st.id;
  }

  // ─── Opportunities (15) — owned by Closers (Emma & James) ─────────────────
  const mkOpp = (p: { title: string; description?: string; value: number; stage: string; stageId: string; probability: number; accountId: string; ownerId: string; ownerName: string; expectedCloseDate: Date; createdAt?: Date; primaryContactId?: string }) =>
    prisma.opportunity.create({ data: { organizationId: O, ...p } });

  const opps: Awaited<ReturnType<typeof mkOpp>>[] = [];
  // DISCOVERY (3)
  opps.push(await mkOpp({ title: "TechCorp — Analytics Platform License",           description: "Annual license for real-time analytics dashboard, 50 seats",                           value: 48000,  stage: "DISCOVERY",      stageId: stages["Discovery"],     probability: 15, accountId: acctHorizon.id,   ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: future(85),  primaryContactId: ctDavidChen.id }));
  opps.push(await mkOpp({ title: "Horizon Cloud — Integration Suite",               description: "API integration platform for multi-cloud orchestration",                               value: 35000,  stage: "DISCOVERY",      stageId: stages["Discovery"],     probability: 10, accountId: acctHorizon.id,   ownerId: james.id,  ownerName: "James Rodriguez",  expectedCloseDate: future(90),  primaryContactId: ctChrisDavis.id }));
  opps.push(await mkOpp({ title: "NexGen Cyber — Threat Intel Module",              description: "Advanced threat intelligence add-on for existing security platform",                   value: 18000,  stage: "DISCOVERY",      stageId: stages["Discovery"],     probability: 20, accountId: acctHorizon.id,   ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: future(75),  primaryContactId: ctSophiaGarcia.id }));
  // QUALIFICATION (3)
  opps.push(await mkOpp({ title: "Meridian Health — Patient Data Platform",          description: "HIPAA-compliant data platform for 12 hospital network, 3-year contract",              value: 95000,  stage: "QUALIFICATION",  stageId: stages["Qualification"], probability: 35, accountId: acctMeridian.id,  ownerId: james.id,  ownerName: "James Rodriguez",  expectedCloseDate: future(60),  primaryContactId: ctMarkThompson.id }));
  opps.push(await mkOpp({ title: "Pinnacle Mfg — Predictive Maintenance Suite",     description: "IoT-connected predictive maintenance for 8 manufacturing plants",                     value: 72000,  stage: "QUALIFICATION",  stageId: stages["Qualification"], probability: 40, accountId: acctPinnacle.id,  ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: future(50),  primaryContactId: ctAmandaLee.id }));
  opps.push(await mkOpp({ title: "Atlas Financial — Risk Analytics Dashboard",       description: "Custom risk modeling and compliance reporting dashboard",                              value: 28000,  stage: "QUALIFICATION",  stageId: stages["Qualification"], probability: 45, accountId: acctAtlas.id,     ownerId: james.id,  ownerName: "James Rodriguez",  expectedCloseDate: future(45),  primaryContactId: ctRyanOConnor.id }));
  // PROPOSAL (2)
  opps.push(await mkOpp({ title: "Sterling Insurance — Claims Automation",           description: "End-to-end claims processing automation with ML triage, 500+ agents",                  value: 185000, stage: "PROPOSAL",       stageId: stages["Proposal"],      probability: 55, accountId: acctSterling.id,  ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: future(30),  primaryContactId: ctEmilyBrown.id }));
  opps.push(await mkOpp({ title: "Nova Telecom — Enterprise CRM Migration",          description: "Full CRM platform migration from legacy system, 2,000 users",                         value: 120000, stage: "PROPOSAL",       stageId: stages["Proposal"],      probability: 60, accountId: acctNova.id,      ownerId: james.id,  ownerName: "James Rodriguez",  expectedCloseDate: future(25),  primaryContactId: ctMattWalker.id }));
  // NEGOTIATION (2)
  opps.push(await mkOpp({ title: "Velocity Logistics — Supply Chain Visibility",     description: "Real-time supply chain tracking and optimization platform, global deployment",         value: 340000, stage: "NEGOTIATION",    stageId: stages["Negotiation"],   probability: 75, accountId: acctVelocity.id,  ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: future(14),  primaryContactId: ctTomWilson.id }));
  opps.push(await mkOpp({ title: "Pinnacle Mfg — Enterprise License Expansion",     description: "Expansion from 8 plants to 22 plants, enterprise-wide license",                       value: 150000, stage: "NEGOTIATION",    stageId: stages["Negotiation"],   probability: 80, accountId: acctPinnacle.id,  ownerId: james.id,  ownerName: "James Rodriguez",  expectedCloseDate: future(10),  primaryContactId: ctAmandaLee.id }));
  // VERBAL COMMIT (1)
  opps.push(await mkOpp({ title: "Atlas Financial — Enterprise Platform Deal",       description: "Full-stack analytics platform with custom integrations and dedicated support",         value: 250000, stage: "VERBAL_COMMIT",  stageId: stages["Verbal Commit"], probability: 90, accountId: acctAtlas.id,     ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: future(5),   primaryContactId: ctRyanOConnor.id }));
  // CLOSED_WON (2)
  opps.push(await mkOpp({ title: "Meridian Health — Initial Platform Deployment",    description: "Phase 1 deployment of patient analytics platform across 4 hospitals",                  value: 75000,  stage: "CLOSED_WON",     stageId: stages["Closed Won"],    probability: 100, accountId: acctMeridian.id, ownerId: james.id,  ownerName: "James Rodriguez",  expectedCloseDate: d(5),  createdAt: d(60), primaryContactId: ctMarkThompson.id }));
  opps.push(await mkOpp({ title: "Atlas Financial — Data Warehouse + BI Suite",      description: "Enterprise data warehouse with embedded BI tools, 18-month contract",                  value: 350000, stage: "CLOSED_WON",     stageId: stages["Closed Won"],    probability: 100, accountId: acctAtlas.id,    ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: d(12), createdAt: d(75), primaryContactId: ctRyanOConnor.id }));
  // CLOSED_LOST (2)
  opps.push(await mkOpp({ title: "Redwood Retail — Commerce Platform",               description: "Lost to competitor — pricing and implementation timeline concerns",                    value: 45000,  stage: "CLOSED_LOST",    stageId: stages["Closed Lost"],   probability: 0,  accountId: acctHorizon.id,  ownerId: emma.id,   ownerName: "Emma Williams",   expectedCloseDate: d(8),  createdAt: d(40) }));
  opps.push(await mkOpp({ title: "Vanguard Energy — Sustainability Analytics",       description: "Prospect chose to build in-house solution after budget restructuring",                 value: 180000, stage: "CLOSED_LOST",    stageId: stages["Closed Lost"],   probability: 0,  accountId: acctVanguard.id, ownerId: james.id,  ownerName: "James Rodriguez",  expectedCloseDate: d(15), createdAt: d(50) }));

  // ─── Tasks (20) — realistic sales tasks ─────────────────────────────────
  await prisma.task.createMany({
    data: [
      // PENDING — upcoming (8)
      { organizationId: O, title: "Send Sterling Insurance proposal to Emily Brown",          type: "EMAIL",     priority: "HIGH",     status: "PENDING",      ownerId: emma.id,    opportunityId: opps[6].id,  dueDate: future(2) },
      { organizationId: O, title: "Schedule demo with Pinnacle Manufacturing team",           type: "MEETING",   priority: "HIGH",     status: "PENDING",      ownerId: james.id,   opportunityId: opps[4].id,  dueDate: future(3) },
      { organizationId: O, title: "Prepare ROI analysis for Velocity Logistics deal",         type: "OTHER",     priority: "MEDIUM",   status: "PENDING",      ownerId: emma.id,    opportunityId: opps[8].id,  dueDate: future(5) },
      { organizationId: O, title: "Research NexGen Cybersecurity tech stack",                  type: "OTHER",     priority: "LOW",      status: "PENDING",      ownerId: alex.id,    leadId: leads[16].id,       dueDate: future(4) },
      { organizationId: O, title: "Send case study to Kevin Martinez at Apex Media",          type: "EMAIL",     priority: "MEDIUM",   status: "PENDING",      ownerId: rachel.id,  leadId: leads[10].id,       dueDate: future(1) },

      // OVERDUE — past due (5)
      { organizationId: O, title: "Follow up with Ryan O'Connor on contract terms",           type: "FOLLOW_UP", priority: "HIGH",     status: "PENDING",      ownerId: emma.id,    opportunityId: opps[10].id, dueDate: d(1) },
      { organizationId: O, title: "Return call from Mark Thompson — Meridian Health",          type: "CALL",      priority: "HIGH",     status: "PENDING",      ownerId: james.id,   leadId: leads[12].id,       dueDate: d(2) },
      { organizationId: O, title: "Send revised SOW for Nova Telecom CRM migration",          type: "EMAIL",     priority: "CRITICAL", status: "PENDING",      ownerId: james.id,   opportunityId: opps[7].id,  dueDate: d(3) },
      { organizationId: O, title: "Schedule discovery call with Quantum Data Analytics",      type: "MEETING",   priority: "MEDIUM",   status: "PENDING",      ownerId: rachel.id,  leadId: leads[5].id,        dueDate: d(1) },
      { organizationId: O, title: "Prepare competitive analysis for Velocity deal",           type: "OTHER",     priority: "HIGH",     status: "PENDING",      ownerId: emma.id,    opportunityId: opps[8].id,  dueDate: d(4) },

      // COMPLETED (4)
      { organizationId: O, title: "Send NDA to Nova Telecommunications",                      type: "EMAIL",     priority: "MEDIUM",   status: "COMPLETED",    ownerId: james.id,   opportunityId: opps[7].id,  dueDate: d(7),  completedAt: d(6) },
      { organizationId: O, title: "Qualification call with Amanda Lee — Pinnacle",             type: "CALL",      priority: "HIGH",     status: "COMPLETED",    ownerId: alex.id,    leadId: leads[17].id,       dueDate: d(5),  completedAt: d(5) },
      { organizationId: O, title: "Demo presentation for Atlas Financial team",                type: "MEETING",   priority: "HIGH",     status: "COMPLETED",    ownerId: emma.id,    opportunityId: opps[12].id, dueDate: d(15), completedAt: d(14) },
      { organizationId: O, title: "Update CRM with Redwood Retail prospecting notes",         type: "OTHER",     priority: "LOW",      status: "COMPLETED",    ownerId: alex.id,    leadId: leads[23].id,       dueDate: d(12), completedAt: d(11) },

      // IN_PROGRESS (3)
      { organizationId: O, title: "Finalize pricing for Atlas Enterprise Platform deal",       type: "OTHER",     priority: "CRITICAL", status: "IN_PROGRESS",  ownerId: emma.id,    opportunityId: opps[10].id, dueDate: future(1) },
      { organizationId: O, title: "Draft Sterling Insurance implementation timeline",          type: "OTHER",     priority: "HIGH",     status: "IN_PROGRESS",  ownerId: emma.id,    opportunityId: opps[6].id,  dueDate: future(2) },
      { organizationId: O, title: "Qualify lead Sophia Garcia — NexGen Cybersecurity",         type: "CALL",      priority: "MEDIUM",   status: "IN_PROGRESS",  ownerId: alex.id,    leadId: leads[16].id,       dueDate: future(1) },

      // Additional tasks to round out to 20
      { organizationId: O, title: "Prepare contract for Atlas Financial Enterprise deal",    type: "OTHER",     priority: "HIGH",     status: "PENDING",      ownerId: emma.id,    opportunityId: opps[10].id, dueDate: future(3) },
      { organizationId: O, title: "Send LinkedIn message to Ben Thomas — ClearPath",         type: "EMAIL",     priority: "LOW",      status: "PENDING",      ownerId: rachel.id,  leadId: leads[3].id,        dueDate: future(6) },
      { organizationId: O, title: "Coordinate reference call for Nova Telecom evaluation",   type: "CALL",      priority: "HIGH",     status: "IN_PROGRESS",  ownerId: james.id,   opportunityId: opps[7].id,  dueDate: future(2) },
    ],
  });

  // ─── Meetings (10) — discovery calls, demos, negotiations ─────────────────
  await prisma.meeting.createMany({
    data: [
      // Past (5)
      { organizationId: O, title: "Discovery call with Atlas Financial leadership",       ownerId: emma.id,   contactId: ctRyanOConnor.id,     leadId: leads[11].id,                         startTime: d(10, 9),     endTime: d(10, 10),     location: "Virtual — Zoom",                          notes: "Ryan confirmed budget for Q2. Wants ROI analysis before board meeting.",                           attendees: JSON.stringify(["Ryan O'Connor", "Alice Moore"]) },
      { organizationId: O, title: "Meridian Health platform demo",                        ownerId: james.id,  contactId: ctMarkThompson.id,    opportunityId: opps[3].id,                    startTime: d(5, 14),     endTime: d(5, 16),      location: "Virtual — Microsoft Teams",               notes: "Demo well received. Mark wants formal proposal by Friday. Compliance team needs HIPAA review.",    attendees: JSON.stringify(["Mark Thompson", "Jennifer Baker", "Diana Ross"]) },
      { organizationId: O, title: "Q1 pipeline review — sales leadership",                ownerId: mike.id,   contactId: ctRyanOConnor.id,                                                   startTime: d(3, 10),     endTime: d(3, 12),      location: "Conference Room B — HQ",                  notes: "Pipeline is healthy. Focus on converting Proposal-stage deals. Need competitive intel on 2 deals.",attendees: JSON.stringify(["Mike Johnson", "Sarah Chen", "Emma Williams", "James Rodriguez"]) },
      { organizationId: O, title: "Sterling Insurance stakeholder alignment",             ownerId: emma.id,   contactId: ctEmilyBrown.id,      opportunityId: opps[6].id,                    startTime: d(7, 11),     endTime: d(7, 12),      location: "Virtual — Google Meet",                   notes: "Emily aligned internally. Legal review of MSA next week.",                                         attendees: JSON.stringify(["Emily Brown", "Jason Taylor", "Heather Young"]) },
      { organizationId: O, title: "Velocity Logistics — technical deep dive",             ownerId: emma.id,   contactId: ctTomWilson.id,       opportunityId: opps[8].id,                    startTime: d(4, 13),     endTime: d(4, 15),      location: "Virtual — Zoom",                          notes: "CTO impressed with API capabilities. Needs integration specs for legacy ERP.",                      attendees: JSON.stringify(["Tom Wilson", "Greg Anderson"]) },
      // Future (5)
      { organizationId: O, title: "Nova Telecom — CRM migration kickoff planning",       ownerId: james.id,  contactId: ctMattWalker.id,      opportunityId: opps[7].id,                    startTime: future(2, 14),endTime: future(2, 16),  location: "Virtual — Zoom",                          attendees: JSON.stringify(["Matt Walker", "Sarah Hall"]) },
      { organizationId: O, title: "Pinnacle Manufacturing — plant visit + demo",          ownerId: emma.id,   contactId: ctAmandaLee.id,       opportunityId: opps[4].id,                    startTime: future(5, 9), endTime: future(5, 12),  location: "Pinnacle Detroit HQ — 1200 Industrial Blvd", attendees: JSON.stringify(["Amanda Lee", "Brian Miller", "Steve Martin"]) },
      { organizationId: O, title: "Atlas Financial — contract negotiation",               ownerId: emma.id,   contactId: ctRyanOConnor.id,     opportunityId: opps[10].id,                   startTime: future(1, 10),endTime: future(1, 11),  location: "Atlas NYC Office — 450 Park Ave",         attendees: JSON.stringify(["Ryan O'Connor"]) },
      { organizationId: O, title: "Quarterly business review with Meridian Health",       ownerId: james.id,  contactId: ctMarkThompson.id,    opportunityId: opps[11].id,                   startTime: future(4, 15),endTime: future(4, 16),  location: "Virtual — Microsoft Teams",               attendees: JSON.stringify(["Mark Thompson", "Jennifer Baker"]) },
      { organizationId: O, title: "Discovery call — Quantum Data Analytics",              ownerId: rachel.id, contactId: ctNatalieWu.id,       leadId: leads[5].id,                          startTime: future(3, 11),endTime: future(3, 12),  location: "Virtual — Zoom",                          attendees: JSON.stringify(["Natalie Wu"]) },
    ],
  });

  // ─── Activities (45) — rich activity history, spread across 60 days ──────
  await prisma.activity.createMany({
    data: [
      // Week 1 (recent)
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Revised pricing for Atlas Enterprise Platform",     body: "Sent updated pricing with volume discount for 3-year commitment. Waiting on Ryan's feedback.",                          creatorId: emma.id,    leadId: leads[11].id, opportunityId: opps[10].id, createdAt: d(0, 9) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Qualification call — Natalie Wu, Quantum Data",    body: "45-minute call. Discussed data pipeline needs. Strong fit for our analytics module. Scheduling demo.",                  creatorId: rachel.id,  leadId: leads[5].id,                              createdAt: d(0, 14) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Champion confirmed — Atlas Financial",             body: "Ryan O'Connor confirmed board approved Q2 budget for analytics platform. Moving to verbal commit.",                     creatorId: emma.id,    leadId: leads[11].id,                             createdAt: d(1, 10) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Follow-up from SaaStr conference",                 body: "Kevin Martinez from Apex Media requested a demo after meeting at SaaStr. Hot referral from existing customer.",          creatorId: rachel.id,  leadId: leads[10].id,                             createdAt: d(1, 16) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: DISCOVERY -> QUALIFICATION",                body: "Meridian Health — Patient Data Platform advanced to Qualification.",                                                     creatorId: james.id,   opportunityId: opps[3].id,                        createdAt: d(2, 11) },

      // Week 2
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "ROI analysis for Velocity Logistics",              body: "Sent ROI analysis projecting 34% efficiency gain and $1.2M annual savings from supply chain visibility.",                creatorId: emma.id,    opportunityId: opps[8].id,                        createdAt: d(4, 9) },
      { organizationId: O, type: "MEETING",      channel: "video",    subject: "Sterling Insurance technical deep dive",           body: "Demo with 8 Sterling stakeholders. Strong interest in ML triage capabilities. Need HIPAA compliance docs.",               creatorId: emma.id,    opportunityId: opps[6].id,                        createdAt: d(5, 14) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Pricing negotiation — Atlas Financial",            body: "Ryan requested 12% discount for 3-year commitment. Counter-offered with 8% discount + premium support tier.",             creatorId: emma.id,    opportunityId: opps[10].id,                       createdAt: d(5, 10) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Risk flag — NexGen Cybersecurity deal",            body: "NexGen board meeting pushed to next quarter. May delay decision on Threat Intel Module by 30 days.",                      creatorId: mike.id,    opportunityId: opps[2].id,                        createdAt: d(6, 15) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "MSA sent for Pinnacle Enterprise expansion",       body: "Legal reviewed the Pinnacle enterprise expansion contract. Sent MSA to Amanda Lee for signature.",                       creatorId: james.id,   opportunityId: opps[9].id,                        createdAt: d(6, 9) },

      // Week 3
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Cold outreach — David Chen, TechCorp",             body: "First call with David Chen. Interested in analytics platform for engineering team. Scheduling follow-up demo.",           creatorId: alex.id,    leadId: leads[0].id,                              createdAt: d(8, 11) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Referral intro — Nick Jackson, Prism AI Labs",     body: "Nick was referred by an investor. AI-native company looking for sales intelligence platform. Very strong fit.",           creatorId: rachel.id,  leadId: leads[1].id,                              createdAt: d(8, 16) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Nova Telecom — CRM migration proposal",            body: "Sent detailed migration proposal with phased rollout plan. 2,000 users across 4 offices.",                                creatorId: james.id,   opportunityId: opps[7].id,                        createdAt: d(10, 9) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: PROPOSAL -> NEGOTIATION",                   body: "Velocity Logistics — Supply Chain Visibility advanced to Negotiation.",                                                   creatorId: emma.id,    opportunityId: opps[8].id,                        createdAt: d(10, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Follow-up with Matt Walker — Nova Telecom",        body: "Matt wants to include custom API integrations in scope. Deal value may increase to $150K.",                               creatorId: james.id,   leadId: leads[19].id,  opportunityId: opps[7].id, createdAt: d(12, 14) },

      // Week 4
      { organizationId: O, type: "MEETING",      channel: "video",    subject: "Monthly pipeline review — leadership",             body: "Monthly pipeline review. Focus on converting 3 Proposal-stage deals. Need competitive intel for Sterling.",              creatorId: mike.id,                                                       createdAt: d(14, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Negotiation with Amanda Lee — Pinnacle",           body: "Amanda negotiating implementation timeline. Wants pilot in 2 plants before full rollout.",                                creatorId: emma.id,    opportunityId: opps[4].id,                        createdAt: d(15, 14) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Welcome package — Meridian Health Phase 1",        body: "Sent onboarding package after closing Phase 1. Customer success team assigned.",                                          creatorId: james.id,   opportunityId: opps[11].id,                       createdAt: d(18, 9) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Forecast update — Q2",                             body: "Q2 forecast updated: commit $425K, best case $1.2M. Pipeline looks strong.",                                             creatorId: sarah.id,                                                      createdAt: d(20, 16) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Outbound prospecting — Tom Wilson, Velocity",      body: "Tom from Velocity interested in supply chain visibility platform. Previously using legacy system.",                        creatorId: alex.id,    leadId: leads[20].id,                             createdAt: d(22, 11) },

      // Wins, losses, stage changes
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: NEGOTIATION -> CLOSED_WON",                 body: "Atlas Financial — Data Warehouse + BI Suite closed for $350,000. 18-month contract.",                                     creatorId: emma.id,    opportunityId: opps[12].id,                       createdAt: d(5, 17) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: PROPOSAL -> CLOSED_WON",                    body: "Meridian Health — Initial Platform Deployment closed for $75,000.",                                                       creatorId: james.id,   opportunityId: opps[11].id,                       createdAt: d(12, 17) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Lost deal post-mortem — Redwood Retail",            body: "Redwood chose competitor due to faster implementation timeline and lower first-year cost.",                                creatorId: emma.id,                                                       createdAt: d(8, 10) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: NEGOTIATION -> CLOSED_LOST",                 body: "Vanguard Energy — Sustainability Analytics lost. Prospect chose to build in-house.",                                       creatorId: james.id,   opportunityId: opps[14].id,                       createdAt: d(15, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Referral from Ryan O'Connor — Atlas Financial",    body: "Ryan referred Emily Brown from Sterling Insurance. Hot lead for claims automation.",                                       creatorId: alex.id,    leadId: leads[18].id,                             createdAt: d(25, 14) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Weekly SDR standup notes",                          body: "Alex: 5 qualified leads this week. Rachel: 3 demos scheduled. Pipeline growing 15% MoM.",                                creatorId: mike.id,                                                       createdAt: d(3, 9) },

      // Additional activities for volume
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Sterling Insurance — security questionnaire",       body: "Completed and returned Sterling's 120-question security questionnaire. Passed all HIPAA requirements.",                   creatorId: emma.id,    opportunityId: opps[6].id,                        createdAt: d(7, 9) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Cold call — Sophia Garcia, NexGen Cyber",           body: "First call with Sophia. NexGen evaluating threat intelligence platforms. Budget confirmed for Q2.",                        creatorId: alex.id,    leadId: leads[16].id,                             createdAt: d(9, 11) },
      { organizationId: O, type: "WHATSAPP",     channel: "whatsapp", subject: "Quick update from Brian Miller — Pinnacle",        body: "Brian confirmed the pilot plant locations. Detroit and Chicago plants selected for Phase 1.",                              creatorId: alex.id,    leadId: leads[10].id,                             createdAt: d(11, 15) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Nova Telecom — revised implementation timeline",    body: "Sent revised implementation timeline showing 12-week phased rollout instead of big-bang migration.",                      creatorId: james.id,   opportunityId: opps[7].id,                        createdAt: d(13, 9) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Competitive intel — Sterling deal",                 body: "Competitor offering 20% lower price but no ML triage capability. Our differentiation is strong on automation.",           creatorId: emma.id,    opportunityId: opps[6].id,                        createdAt: d(16, 11) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Follow-up with Patrick King — Redwood Retail",     body: "Patrick interested in e-commerce analytics despite lost deal. May be a new opportunity in Q3.",                            creatorId: alex.id,    leadId: leads[8].id,                              createdAt: d(19, 14) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: QUALIFICATION -> PROPOSAL",                  body: "Sterling Insurance — Claims Automation advanced to Proposal.",                                                             creatorId: emma.id,    opportunityId: opps[6].id,                        createdAt: d(21, 10) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "SaaStr Annual 2026 — event recap",                  body: "Summary of SaaStr conference. 12 new leads generated, 3 high-quality prospects identified.",                              creatorId: sarah.id,                                                      createdAt: d(24, 8) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Monthly target achieved — sales team",              body: "Closers team hit 118% of monthly target. Highlight: Emma with 2 closed-won deals worth $425K.",                          creatorId: mike.id,                                                       createdAt: d(28, 16) },

      // More recent activities for depth
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Check-in with Andrew Scott — Summit EdTech",        body: "Andrew evaluating options for next fiscal year. Interested in our analytics module for student outcomes.",                 creatorId: alex.id,    leadId: leads[6].id,                              createdAt: d(2, 15) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Pinnacle MSA redline review",                       body: "Pinnacle legal team sent redlines on MSA. Minor changes to liability cap and SLA terms.",                                 creatorId: james.id,   opportunityId: opps[9].id,                        createdAt: d(3, 11) },
      { organizationId: O, type: "WHATSAPP",     channel: "whatsapp", subject: "Tom Wilson — quick question on integrations",       body: "Tom asked about SAP integration timeline. Confirmed 4-week implementation for ERP connector.",                            creatorId: emma.id,    leadId: leads[20].id,  opportunityId: opps[8].id, createdAt: d(1, 17) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Deal risk — Nova Telecom",                          body: "Nova's procurement team requesting additional references. Need to line up 2 enterprise reference calls this week.",       creatorId: james.id,   opportunityId: opps[7].id,                        createdAt: d(4, 16) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Ironclad Legal Tech — product overview sent",       body: "Sent product overview deck to Rachel Clark. She's evaluating 3 vendors. Decision expected in 6 weeks.",                   creatorId: alex.id,    leadId: leads[13].id,                             createdAt: d(7, 14) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Jessica Lewis — Vanguard Energy analytics needs",  body: "Jessica exploring sustainability reporting tools. Interested in our ESG analytics module.",                                creatorId: rachel.id,  leadId: leads[15].id,                             createdAt: d(9, 16) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Weekly pipeline digest — auto-generated",           body: "Pipeline grew 12% this week. 4 new qualified leads, 2 deals advanced to negotiation stage.",                              creatorId: mike.id,                                                       createdAt: d(0, 7) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Competitive loss analysis — Q1",                    body: "Lost 3 deals to competitors in Q1. Primary reasons: pricing (2), implementation speed (1). Need to address.",            creatorId: sarah.id,                                                      createdAt: d(30, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Laura Adams — Catalyst Biotech check-in",          body: "Laura not ready to buy yet but wants to stay in touch. Moving to nurture track for Q3 re-engagement.",                   creatorId: rachel.id,  leadId: leads[24].id,                             createdAt: d(14, 11) },
    ],
  });

  // ─── Inbox Messages (15) — realistic sales emails ────────────────────────
  await prisma.inboxMessage.createMany({
    data: [
      { organizationId: O, channel: "EMAIL",    sender: "ryan.oconnor@atlasfinancialgroup.com",  subject: "Re: Enterprise Platform — Contract Review",     body: "Emma, I've reviewed the contract with our legal team. A few redlines on the liability cap, but we're close. Can we schedule a call Tuesday to finalize?",    isRead: false, starred: true,  createdAt: d(0, 19) },
      { organizationId: O, channel: "EMAIL",    sender: "matt.walker@novatelecom.com",           subject: "CRM Migration — Timeline Question",             body: "James, can we accelerate the migration timeline? Our legacy system contract ends in 90 days and we need to be fully migrated by then.",                       isRead: false, starred: false, createdAt: d(0, 15) },
      { organizationId: O, channel: "EMAIL",    sender: "emily.brown@sterlinginsurance.com",     subject: "Re: Claims Automation Proposal",                 body: "Hi Emma, the proposal looks great. I'm sharing it with our CFO this week. One question — can we do a proof-of-concept with 50 agents first?",               isRead: false, starred: true,  createdAt: d(0, 7) },
      { organizationId: O, channel: "EMAIL",    sender: "amanda.lee@pinnaclemfg.com",            subject: "Plant Visit Confirmation",                       body: "Emma, confirming the Detroit plant visit next Thursday. I'll have our CTO and plant manager join. Please bring the IoT sensor integration specs.",            isRead: true,  starred: false, createdAt: d(1, 10) },
      { organizationId: O, channel: "EMAIL",    sender: "mark.thompson@meridianhealthsys.com",   subject: "Missed Call — Phase 2 Discussion",               body: "James, sorry I missed your call. I wanted to discuss expanding to the remaining 8 hospitals. Can you send over the Phase 2 pricing?",                        isRead: false, starred: false, createdAt: d(1, 16) },
      { organizationId: O, channel: "EMAIL",    sender: "tom.wilson@velocitylogistics.com",      subject: "Supply Chain Platform — SAP Integration",        body: "Emma, our CTO needs documentation on the SAP ERP connector. Also, can you confirm the API rate limits for real-time tracking?",                              isRead: true,  starred: false, createdAt: d(2, 9) },
      { organizationId: O, channel: "EMAIL",    sender: "natalie.wu@quantumdataanalytics.com",   subject: "Analytics Platform Interest",                    body: "Hi Rachel, great talking with you at SaaStr. We're evaluating analytics platforms for our growing data team. Can you send a product overview?",              isRead: false, starred: true,  createdAt: d(2, 15) },
      { organizationId: O, channel: "EMAIL",    sender: "kevin.martinez@apexmediagroup.com",     subject: "RevOps Platform — Quick Question",               body: "Rachel, I'm comparing your platform to two competitors. What's your typical onboarding time for a team of 30? And do you offer a free trial?",              isRead: false, starred: false, createdAt: d(0, 11) },
      { organizationId: O, channel: "EMAIL",    sender: "rachel.clark@ironcladlegaltech.com",    subject: "Product Demo Request",                           body: "Alex, I've reviewed your product overview. Can we schedule a 45-minute demo for my leadership team next week? We're making a decision by end of Q2.",         isRead: false, starred: true,  createdAt: d(1, 9) },
      { organizationId: O, channel: "EMAIL",    sender: "sophia.garcia@nexgencyber.com",         subject: "Threat Intel Module — Technical Questions",      body: "Emma, before our next call, can you share documentation on your threat feed integrations? We need compatibility with our SIEM platform.",                    isRead: true,  starred: false, createdAt: d(3, 14) },
      { organizationId: O, channel: "EMAIL",    sender: "system@aexiondemo.com",                 subject: "Weekly Pipeline Summary",                        body: "Pipeline grew 12% this week. 4 new qualified leads, 2 deals advanced to negotiation. Total active pipeline: $1.34M.",                                       isRead: false, starred: false, createdAt: d(0, 8), category: "SYSTEM" },
      { organizationId: O, channel: "EMAIL",    sender: "andrew.scott@summitedtech.com",         subject: "Budget Cycle Update",                            body: "Alex, wanted to let you know our budget cycle starts in July. I'd like to include your platform in our FY27 planning. Can you send updated pricing?",        isRead: false, starred: false, createdAt: d(0, 7) },
      { organizationId: O, channel: "EMAIL",    sender: "paul.harris@vanguardenergy.com",        subject: "Sustainability Analytics — Still Interested",    body: "Rachel, even though the deal didn't work out last quarter, we're revisiting the build-vs-buy decision. Can we reconnect next month?",                        isRead: true,  starred: false, createdAt: d(4, 10) },
      { organizationId: O, channel: "EMAIL",    sender: "brian.miller@pinnaclemfg.com",          subject: "Pilot Plant Selection Confirmed",                body: "James, we've confirmed Detroit and Chicago for the pilot. Can you send the implementation checklist so we can start prep on our side?",                      isRead: false, starred: false, createdAt: d(1, 14) },
      { organizationId: O, channel: "EMAIL",    sender: "nick.jackson@prismailabs.com",          subject: "Intro from VC — Sales Intelligence Platform",    body: "Hi Rachel, our investor recommended your platform. We're a 40-person AI startup and need better sales pipeline visibility. Let's chat this week.",           isRead: false, starred: true,  createdAt: d(0, 10) },
    ],
  });

  // ─── Integrations (12) ────────────────────────────────────────────────────
  const integrationNames = ["Gmail", "Google Calendar", "Outlook", "Slack", "HubSpot", "Salesforce", "Zapier", "Stripe", "Zoom", "Microsoft Teams", "Gong", "LinkedIn Sales Navigator"];
  await prisma.integration.createMany({
    data: integrationNames.map((name) => ({
      organizationId: O,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      providerKey: name.toLowerCase().replace(/\s+/g, "-"),
      status: "DISCONNECTED",
      healthPercent: 0,
      eventsReceived: 0,
      errorCount: 0,
    })),
  });

  // ─── Playbooks (5) — sales playbooks ─────────────────────────────────────
  const pb1 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "Discovery Call Playbook",
      description: "Structured approach for initial discovery calls with enterprise prospects",
      segment: "Enterprise",
      stage: "Discovery",
      conversionRate: 68,
      usage: 234,
    },
  });
  const pb2 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "Demo Presentation Playbook",
      description: "Best practices for delivering compelling product demos to buying committees",
      segment: "Mid-Market",
      stage: "Qualification",
      conversionRate: 52,
      usage: 189,
    },
  });
  const pb3 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "Negotiation Playbook",
      description: "Tactics and frameworks for enterprise deal negotiations and pricing discussions",
      segment: "Enterprise",
      stage: "Negotiation",
      conversionRate: 74,
      usage: 145,
    },
  });
  const pb4 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "Objection Handling Playbook",
      description: "Common objections in B2B SaaS sales and proven response frameworks",
      segment: "All",
      stage: "Qualification",
      conversionRate: 61,
      usage: 312,
    },
  });
  const pb5 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "Closing Playbook",
      description: "Techniques for driving deals to close including urgency creation and stakeholder alignment",
      segment: "Enterprise",
      stage: "Negotiation",
      conversionRate: 78,
      usage: 167,
    },
  });

  // Playbook Steps
  await prisma.playbookStep.createMany({
    data: [
      // Discovery Call
      { playbookId: pb1.id, order: 1, title: "Research the prospect",             description: "Review LinkedIn, company news, tech stack, and recent funding before the call." },
      { playbookId: pb1.id, order: 2, title: "Open with business context",        description: "Start with an insight about their industry or company to establish credibility." },
      { playbookId: pb1.id, order: 3, title: "Uncover pain points",               description: "Use SPIN selling questions to identify core business challenges." },
      { playbookId: pb1.id, order: 4, title: "Qualify BANT criteria",             description: "Assess Budget, Authority, Need, and Timeline during the conversation." },
      { playbookId: pb1.id, order: 5, title: "Set next steps",                    description: "Schedule a follow-up demo or send relevant case study before ending the call." },
      // Demo Presentation
      { playbookId: pb2.id, order: 1, title: "Confirm attendees and agenda",      description: "Send agenda 24h before. Confirm who will attend and their roles." },
      { playbookId: pb2.id, order: 2, title: "Tailor the demo to pain points",    description: "Customize the demo flow based on discovery call findings." },
      { playbookId: pb2.id, order: 3, title: "Show, don't tell",                  description: "Use their actual use case scenarios with realistic data in the demo." },
      { playbookId: pb2.id, order: 4, title: "Handle live objections",            description: "Address concerns in real-time. Use customer stories as proof points." },
      { playbookId: pb2.id, order: 5, title: "Close with mutual action plan",     description: "Agree on evaluation criteria, timeline, and next steps with all stakeholders." },
      // Negotiation
      { playbookId: pb3.id, order: 1, title: "Establish value before price",      description: "Quantify ROI and business impact before discussing pricing." },
      { playbookId: pb3.id, order: 2, title: "Identify decision-making process",  description: "Map the approval chain and understand procurement requirements." },
      { playbookId: pb3.id, order: 3, title: "Create a mutual close plan",        description: "Build a shared timeline with milestones leading to contract signature." },
      { playbookId: pb3.id, order: 4, title: "Negotiate terms, not just price",   description: "Trade concessions on payment terms, contract length, and scope rather than discounting." },
      // Objection Handling
      { playbookId: pb4.id, order: 1, title: "Listen and acknowledge",            description: "Let the prospect fully express their concern before responding." },
      { playbookId: pb4.id, order: 2, title: "Clarify the real objection",        description: "Ask probing questions to understand the underlying concern." },
      { playbookId: pb4.id, order: 3, title: "Respond with evidence",             description: "Use case studies, data points, and customer testimonials to address the objection." },
      { playbookId: pb4.id, order: 4, title: "Confirm resolution",                description: "Ask if the concern has been addressed and if there are other blockers." },
      // Closing
      { playbookId: pb5.id, order: 1, title: "Confirm all stakeholders aligned",  description: "Ensure champion, economic buyer, and technical evaluator are all on board." },
      { playbookId: pb5.id, order: 2, title: "Remove procurement blockers",       description: "Proactively address security reviews, legal terms, and vendor assessment forms." },
      { playbookId: pb5.id, order: 3, title: "Create urgency",                    description: "Tie close date to business events, budget cycles, or implementation timelines." },
      { playbookId: pb5.id, order: 4, title: "Execute the close",                 description: "Send final contract, schedule signing meeting, and prepare handoff to customer success." },
    ],
  });

  // ─── Insights (8) — AI-style insights ────────────────────────────────────
  await prisma.insight.createMany({
    data: [
      { organizationId: O, category: "pipeline",    title: "High-value deals stalling in Negotiation",       description: "2 deals worth $490K combined have been in Negotiation for over 10 days without activity.",                               impact: "HIGH",   confidence: 92, suggestedAction: "Schedule executive alignment calls for Velocity and Pinnacle deals this week.",    opportunityId: opps[8].id },
      { organizationId: O, category: "engagement",  title: "Response time improving across team",            description: "Average lead response time dropped 28% this month, from 3.2 hours to 2.3 hours.",                                      impact: "MEDIUM", confidence: 87, suggestedAction: "Maintain current cadence. Share Alex's response templates with the team." },
      { organizationId: O, category: "risk",         title: "Nova Telecom deal at risk",                      description: "Nova's procurement team requesting additional enterprise references. Deal may stall without 2 reference calls.",        impact: "HIGH",   confidence: 95, suggestedAction: "Line up reference calls with Atlas Financial and Meridian Health this week.",     opportunityId: opps[7].id },
      { organizationId: O, category: "performance",  title: "Top performer: Emma Williams",                   description: "Emma closed $425K this quarter with a 62% win rate. Best conversion on enterprise deals.",                             impact: "LOW",    confidence: 98, suggestedAction: "Schedule knowledge-sharing session with the team." },
      { organizationId: O, category: "pipeline",    title: "Pipeline concentration risk — Atlas Financial",   description: "38% of the active pipeline value is concentrated in Atlas Financial deals.",                                            impact: "HIGH",   confidence: 90, suggestedAction: "Accelerate prospecting to diversify pipeline across 3+ new accounts.",           leadId: leads[11].id },
      { organizationId: O, category: "engagement",  title: "Cold leads without re-engagement",               description: "6 leads with COLD temperature have not been contacted in over 15 days.",                                               impact: "MEDIUM", confidence: 85, suggestedAction: "Launch automated email nurture sequence for cold leads." },
      { organizationId: O, category: "conversion",  title: "Qualification-to-Proposal conversion trending up",description: "Qualification-to-Proposal conversion rate increased from 42% to 58% over the last 30 days.",                          impact: "MEDIUM", confidence: 88, suggestedAction: "Document the improved qualification criteria for team training." },
      { organizationId: O, category: "risk",         title: "Sterling Insurance — competitive threat",         description: "Competitor offering 20% lower pricing on claims automation. Sterling evaluating both vendors.",                          impact: "HIGH",   confidence: 91, suggestedAction: "Emphasize ML triage differentiation and offer a proof-of-concept.",              opportunityId: opps[6].id },
    ],
  });

  // ─── Recommendations (5) ──────────────────────────────────────────────────
  await prisma.recommendation.createMany({
    data: [
      { organizationId: O, action: "Schedule executive sponsor call for Velocity Logistics deal",       reason: "$340K deal in Negotiation for 10+ days. Executive alignment can accelerate procurement approval.",                priority: "HIGH",     opportunityId: opps[8].id },
      { organizationId: O, action: "Send Atlas Financial case study to Sterling Insurance",              reason: "Sterling evaluating competitors. Showing a similar enterprise win can strengthen our position.",                  priority: "MEDIUM",   leadId: leads[18].id },
      { organizationId: O, action: "Re-engage COLD leads with industry-specific content campaign",       reason: "6 cold leads with no contact for 15+ days. Targeted content can reactivate 2-3 opportunities.",                 priority: "LOW" },
      { organizationId: O, action: "Prepare counter-proposal for Nova Telecom CRM migration",            reason: "Nova requested timeline acceleration. Without updated proposal in 3 days, $120K deal may go to competitor.",     priority: "CRITICAL", opportunityId: opps[7].id },
      { organizationId: O, action: "Schedule QBR with Meridian Health to discuss Phase 2 expansion",     reason: "Phase 1 deployed successfully. Phase 2 expansion to 8 hospitals could be a $200K+ upsell opportunity.",          priority: "HIGH",     opportunityId: opps[11].id },
    ],
  });

  // ─── Forecast Snapshots (3) — monthly forecasts ─────────────────────────
  await prisma.forecastSnapshot.createMany({
    data: [
      { organizationId: O, quarter: "Q1", year: 2026, commit: 425000,   bestCase: 650000,   pipeline: 1800000,  target: 500000 },
      { organizationId: O, quarter: "Q2", year: 2026, commit: 590000,   bestCase: 1200000,  pipeline: 2400000,  target: 750000 },
      { organizationId: O, quarter: "Q3", year: 2026, commit: 0,        bestCase: 350000,   pipeline: 800000,   target: 750000 },
    ],
  });

  // ─── Audit Logs ──────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { organizationId: O, userId: emma.id,          action: "opportunity.closed_won",   objectType: "Opportunity", objectId: opps[12].id,  details: "Atlas Financial — Data Warehouse + BI Suite closed for $350,000",       source: "web", createdAt: d(5) },
      { organizationId: O, userId: james.id,         action: "opportunity.closed_won",   objectType: "Opportunity", objectId: opps[11].id,  details: "Meridian Health — Initial Platform Deployment closed for $75,000",      source: "web", createdAt: d(12) },
      { organizationId: O, userId: alex.id,          action: "lead.status_changed",      objectType: "Lead",        objectId: leads[11].id, details: "Status changed from CONTACTED to QUALIFIED",                            source: "web", createdAt: d(15) },
      { organizationId: O, userId: rachel.id,        action: "lead.status_changed",      objectType: "Lead",        objectId: leads[12].id, details: "Status changed from NEW to QUALIFIED",                                  source: "web", createdAt: d(18) },
      { organizationId: O, userId: aexionAdmin.id,   action: "settings.modules_updated", objectType: "Organization", objectId: org.id,      details: "Enabled modules: commercial, data, reports, automation, post_sale, playbooks", source: "admin", createdAt: d(30) },
    ],
  });

  // ─── Webhook Events ──────────────────────────────────────────────────────
  const integrations = await prisma.integration.findMany({ select: { id: true }, take: 2 });
  if (integrations.length > 0) {
    await prisma.webhookEvent.createMany({
      data: [
        { integrationId: integrations[0].id, eventType: "contact.created", status: "processed", payload: '{"type":"contact","action":"create"}', retryCount: 0 },
        { integrationId: integrations[0].id, eventType: "deal.updated",    status: "processed", payload: '{"type":"deal","action":"update"}',    retryCount: 0 },
        { integrationId: integrations[0].id, eventType: "email.received",  status: "failed",    payload: '{"type":"email","error":"timeout"}',   retryCount: 3 },
      ],
    });
  }

  console.log("US B2B SaaS Demo seed completed successfully!");
  console.log(`
  Summary:
  - 1 Organization: Aexion Demo Corp (USD, America/New_York)
  - 4 Teams (Sales Development, Enterprise Sales, Sales Leadership, Executive Team)
  - 7 Users (2 ADMIN, 1 MANAGER, 2 CLOSER, 2 SDR)
  - 20 Companies (US tech/enterprise), 35 Contacts
  - 25 Leads (NEW:5, CONTACTED:6, QUALIFIED:5, CONVERTED:4, DISQUALIFIED:3, NURTURING:2)
  - 8 Accounts (2 customers)
  - 15 Opportunities (DISCOVERY:3, QUALIFICATION:3, PROPOSAL:2, NEGOTIATION:2, VERBAL_COMMIT:1, WON:2, LOST:2)
  - 20 Tasks (PENDING:7, OVERDUE:5, COMPLETED:4, IN_PROGRESS:4)
  - 10 Meetings (5 past, 5 future)
  - 45 Activities (spread across 30 days)
  - 15 Inbox Messages
  - 12 Integrations, 5 Playbooks (with steps), 8 Insights, 5 Recommendations
  - 3 Forecast Snapshots

  Login credentials:
  - aexion@aexioncore.com / aexion123 (ADMIN — Executive Team)
  - sarah.chen@aexiondemo.com / demo123 (ADMIN — Executive Team)
  - mike.johnson@aexiondemo.com / demo123 (MANAGER — Sales Leadership)
  - emma.williams@aexiondemo.com / demo123 (CLOSER — Enterprise Sales)
  - james.rodriguez@aexiondemo.com / demo123 (CLOSER — Enterprise Sales)
  - alex.kim@aexiondemo.com / demo123 (SDR — Sales Development)
  - rachel.nguyen@aexiondemo.com / demo123 (SDR — Sales Development)
  `);
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
