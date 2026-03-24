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
  console.log("Starting Real Estate seed...");

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
      name: "Aexion Realty Group",
      slug: "aexion-realty",
      displayName: "Aexion Realty Group",
      industry: "Real Estate",
      defaultCurrency: "BRL",
      setupCompleted: true,
      setupStep: 5,
      enabledModules: JSON.stringify(["commercial", "data", "reports", "automation", "post_sale", "playbooks"]),
    },
  });
  const O = org.id;

  // ─── Teams (4) ────────────────────────────────────────────────────────────
  const sdrTeam = await prisma.team.create({ data: { organizationId: O, name: "SDR Team", description: "Prospecting and qualification of real estate leads" } });
  const closerTeam = await prisma.team.create({ data: { organizationId: O, name: "Closers", description: "Negotiation and closing of property sales" } });
  const mgrTeam = await prisma.team.create({ data: { organizationId: O, name: "Management", description: "Commercial and operational management" } });
  const leaderTeam = await prisma.team.create({ data: { organizationId: O, name: "Leadership", description: "Executive leadership and strategic direction" } });

  // ─── Users (6) ────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash("password123", 10);
  const mkUser = (email: string, name: string, role: string, workspace: string, teamId: string) =>
    prisma.user.create({ data: { organizationId: O, teamId, email, name, password: pw, role, workspace, isActive: true } });

  const marcelo   = await mkUser("marcelo@aexionrealty.com.br",  "Marcelo Tavares",    "SDR",     "SDR",       sdrTeam.id);
  const bianca    = await mkUser("bianca@aexionrealty.com.br",   "Bianca Ferreira",    "SDR",     "SDR",       sdrTeam.id);
  const rodrigo   = await mkUser("rodrigo@aexionrealty.com.br",  "Rodrigo Mendes",     "CLOSER",  "CLOSER",    closerTeam.id);
  const juliana   = await mkUser("juliana@aexionrealty.com.br",  "Juliana Almeida",    "CLOSER",  "CLOSER",    closerTeam.id);
  const carlos    = await mkUser("carlos@aexionrealty.com.br",   "Carlos Drummond",    "MANAGER", "MANAGER",   mgrTeam.id);
  const fernanda  = await mkUser("fernanda@aexionrealty.com.br", "Fernanda Vasconcelos", "ADMIN", "EXECUTIVE", leaderTeam.id);

  // Set team managers
  await prisma.team.update({ where: { id: sdrTeam.id }, data: { managerId: carlos.id } });
  await prisma.team.update({ where: { id: closerTeam.id }, data: { managerId: carlos.id } });
  await prisma.team.update({ where: { id: mgrTeam.id }, data: { managerId: fernanda.id } });
  await prisma.team.update({ where: { id: leaderTeam.id }, data: { managerId: fernanda.id } });

  // ─── Companies (15) — Real Estate related ─────────────────────────────────
  const mkCo = (name: string, industry: string, size: string, website: string, annualRevenue?: number) =>
    prisma.company.create({ data: { organizationId: O, name, industry, size, website, annualRevenue } });

  const [
    coMRV, coTegra, coCyrela, coEZTEC, coPatrimonial,
    coVotorantim, coAFG, coGalpao, coArqProjeto, coSulAmerica,
    coHemisferio, coAtlantic, coNexus, coVivaz, coPlanalto,
  ] = await Promise.all([
    mkCo("MRV Engineering",             "Civil Construction",          "5001-10000", "https://mrv.com.br",            1200000000),
    mkCo("Tegra Development Corp",      "Real Estate Development",     "501-1000",   "https://tegra.com.br",          450000000),
    mkCo("Cyrela Brazil Realty",         "Real Estate Development",     "1001-5000",  "https://cyrela.com.br",         800000000),
    mkCo("EZTEC Developments",           "Real Estate Development",     "501-1000",   "https://eztec.com.br",          600000000),
    mkCo("Patrimonial Investments",      "Real Estate Investments",     "51-200",     "https://patrimonialinvest.com.br", 120000000),
    mkCo("Votorantim Building Materials","Construction Materials",      "5001-10000", "https://votorantimcimentos.com.br", 2000000000),
    mkCo("AFG Construction",             "Civil Construction",          "201-500",    "https://afgconstrutora.com.br",  85000000),
    mkCo("SP Logistics Warehouse",       "Industrial Development",      "51-200",     "https://galpaologistico.com.br", 65000000),
    mkCo("ArqProjeto Architecture",      "Architecture & Design",       "11-50",      "https://arqprojeto.com.br",      15000000),
    mkCo("SulAmerica Investments",       "Real Estate Fund Management", "201-500",    "https://sulamerica.com.br",      500000000),
    mkCo("Hemisferio Sul Land Development","Land Development",          "201-500",    "https://hemisferiosul.com.br",   180000000),
    mkCo("Atlantic Properties",          "Luxury Real Estate",          "11-50",      "https://atlanticproperties.com.br", 45000000),
    mkCo("Nexus Engineering",            "Structural Engineering",      "51-200",     "https://nexuseng.com.br",        35000000),
    mkCo("Vivaz Residential",            "Affordable Housing",          "201-500",    "https://vivaz.com.br",           300000000),
    mkCo("Planalto Earthworks",          "Earthwork & Foundation",      "51-200",     "https://planaltoterra.com.br",   22000000),
  ]);

  // ─── Contacts (22) ────────────────────────────────────────────────────────
  const mkContact = (name: string, email: string, title: string, companyId: string, phone?: string, isDecisionMaker = false, isChampion = false) =>
    prisma.contact.create({ data: { organizationId: O, name, email, title, companyId, phone, isDecisionMaker, isChampion } });

  const [
    ctEduardo, ctRenata, ctGustavo, ctPatricia, ctAndre,
    ctLuciana, ctFelipe, ctMariana, ctRoberto, ctCamila,
    ctThiago, ctAline, ctDiego, ctVanessa, ctLeandro,
    ctPriscila, ctDaniel, ctIsabela, ctMarcus, ctFernandaCt,
    ctRicardo, ctBeatriz,
  ] = await Promise.all([
    mkContact("Eduardo Martins",   "eduardo@mrv.com.br",             "Sales Director",              coMRV.id,          "+55 31 99876-5432", true, false),
    mkContact("Renata Campos",     "renata@mrv.com.br",              "New Business Manager",        coMRV.id,          "+55 31 98765-4321", false, true),
    mkContact("Gustavo Pereira",   "gustavo@tegra.com.br",           "CEO",                         coTegra.id,        "+55 11 99654-3210", true, false),
    mkContact("Patricia Borges",   "patricia@tegra.com.br",          "Procurement Manager",         coTegra.id,        "+55 11 97543-2109", false, true),
    mkContact("Andre Lourenco",    "andre@cyrela.com.br",            "VP of Development",           coCyrela.id,       "+55 11 96432-1098", true, true),
    mkContact("Luciana Santos",    "luciana@eztec.com.br",           "Project Director",            coEZTEC.id,        "+55 11 95321-0987", true, false),
    mkContact("Felipe Rocha",     "felipe@patrimonialinvest.com.br", "Managing Partner",            coPatrimonial.id,  "+55 21 94210-9876", true, true),
    mkContact("Mariana Costa",    "mariana@votorantimcimentos.com.br","Regional Manager SP",         coVotorantim.id,   "+55 11 93109-8765", false, false),
    mkContact("Roberto Nascimento","roberto@afgconstrutora.com.br",  "Construction Director",       coAFG.id,          "+55 62 92098-7654", true, false),
    mkContact("Camila Diniz",      "camila@galpaologistico.com.br",  "Expansion Director",          coGalpao.id,       "+55 11 91087-6543", true, true),
    mkContact("Thiago Assis",     "thiago@arqprojeto.com.br",        "Founding Partner",            coArqProjeto.id,   "+55 11 90976-5432", true, false),
    mkContact("Aline Duarte",     "aline@sulamerica.com.br",         "Real Estate Fund Manager",    coSulAmerica.id,   "+55 21 99865-4321", true, true),
    mkContact("Diego Moreira",    "diego@hemisferiosul.com.br",      "Land Development Director",   coHemisferio.id,   "+55 41 98754-3210", true, false),
    mkContact("Vanessa Ribeiro",  "vanessa@atlanticproperties.com.br","Senior Broker",               coAtlantic.id,     "+55 11 97643-2109", false, true),
    mkContact("Leandro Fonseca",  "leandro@nexuseng.com.br",         "Chief Engineer",              coNexus.id,        "+55 19 96532-1098", true, false),
    mkContact("Priscila Machado", "priscila@vivaz.com.br",           "Sales Manager",               coVivaz.id,        "+55 11 95421-0987", false, true),
    mkContact("Daniel Augusto",   "daniel@planaltoterra.com.br",     "Operations Director",         coPlanalto.id,     "+55 62 94310-9876", true, false),
    mkContact("Isabela Monteiro", "isabela@cyrela.com.br",           "Investment Analyst",          coCyrela.id,       "+55 11 93209-8765", false, false),
    mkContact("Marcus Vinicius",  "marcus@eztec.com.br",             "Construction Coordinator",    coEZTEC.id,        "+55 11 92198-7654", false, false),
    mkContact("Fernanda Lima",    "fernanda.lima@afgconstrutora.com.br","Administrative Manager",   coAFG.id,          "+55 62 91087-6543", false, false),
    mkContact("Ricardo Teixeira", "ricardo@patrimonialinvest.com.br","M&A Analyst",                 coPatrimonial.id,  "+55 21 90976-5432", false, false),
    mkContact("Beatriz Carvalho", "beatriz@hemisferiosul.com.br",    "Sales Manager",               coHemisferio.id,   "+55 41 99865-4321", false, true),
  ]);

  // ─── Leads (25) — owned by SDRs (Marcelo & Bianca) ───────────────────────
  const mkLead = (p: { name: string; email: string; phone?: string; title?: string; companyId: string; contactId: string; ownerId: string; source: string; status: string; temperature: string; fitScore: number; lastContact?: Date }) =>
    prisma.lead.create({ data: { organizationId: O, ...p } });

  const leads = await Promise.all([
    // NEW (5)
    mkLead({ name: "Eduardo Martins",    email: "eduardo@mrv.com.br",              phone: "+55 31 99876-5432", title: "Sales Director",           companyId: coMRV.id,         contactId: ctEduardo.id,   ownerId: marcelo.id, source: "linkedin",  status: "NEW",          temperature: "WARM",  fitScore: 72 }),
    mkLead({ name: "Mariana Costa",      email: "mariana@votorantimcimentos.com.br",phone: "+55 11 93109-8765", title: "Regional Manager SP",      companyId: coVotorantim.id,  contactId: ctMariana.id,   ownerId: bianca.id,  source: "web",       status: "NEW",          temperature: "COLD",  fitScore: 45 }),
    mkLead({ name: "Roberto Nascimento", email: "roberto@afgconstrutora.com.br",   phone: "+55 62 92098-7654", title: "Construction Director",    companyId: coAFG.id,         contactId: ctRoberto.id,   ownerId: marcelo.id, source: "event",     status: "NEW",          temperature: "COLD",  fitScore: 38 }),
    mkLead({ name: "Leandro Fonseca",    email: "leandro@nexuseng.com.br",         phone: "+55 19 96532-1098", title: "Chief Engineer",           companyId: coNexus.id,       contactId: ctLeandro.id,   ownerId: bianca.id,  source: "referral",  status: "NEW",          temperature: "WARM",  fitScore: 60 }),
    mkLead({ name: "Daniel Augusto",     email: "daniel@planaltoterra.com.br",     phone: "+55 62 94310-9876", title: "Operations Director",      companyId: coPlanalto.id,    contactId: ctDaniel.id,    ownerId: marcelo.id, source: "web",       status: "NEW",          temperature: "COLD",  fitScore: 32 }),

    // CONTACTED (6)
    mkLead({ name: "Gustavo Pereira",    email: "gustavo@tegra.com.br",            phone: "+55 11 99654-3210", title: "CEO",                      companyId: coTegra.id,       contactId: ctGustavo.id,   ownerId: bianca.id,  source: "linkedin",  status: "CONTACTED",    temperature: "WARM",  fitScore: 78, lastContact: d(3) }),
    mkLead({ name: "Camila Diniz",       email: "camila@galpaologistico.com.br",   phone: "+55 11 91087-6543", title: "Expansion Director",       companyId: coGalpao.id,      contactId: ctCamila.id,    ownerId: marcelo.id, source: "web",       status: "CONTACTED",    temperature: "WARM",  fitScore: 68, lastContact: d(5) }),
    mkLead({ name: "Thiago Assis",       email: "thiago@arqprojeto.com.br",        phone: "+55 11 90976-5432", title: "Founding Partner",         companyId: coArqProjeto.id,  contactId: ctThiago.id,    ownerId: bianca.id,  source: "email",     status: "CONTACTED",    temperature: "COLD",  fitScore: 52, lastContact: d(8) }),
    mkLead({ name: "Priscila Machado",   email: "priscila@vivaz.com.br",           phone: "+55 11 95421-0987", title: "Sales Manager",            companyId: coVivaz.id,       contactId: ctPriscila.id,  ownerId: marcelo.id, source: "event",     status: "CONTACTED",    temperature: "WARM",  fitScore: 74, lastContact: d(2) }),
    mkLead({ name: "Vanessa Ribeiro",    email: "vanessa@atlanticproperties.com.br",phone: "+55 11 97643-2109", title: "Senior Broker",            companyId: coAtlantic.id,    contactId: ctVanessa.id,   ownerId: bianca.id,  source: "referral",  status: "CONTACTED",    temperature: "HOT",   fitScore: 85, lastContact: d(1) }),
    mkLead({ name: "Beatriz Carvalho",   email: "beatriz@hemisferiosul.com.br",    phone: "+55 41 99865-4321", title: "Sales Manager",            companyId: coHemisferio.id,  contactId: ctBeatriz.id,   ownerId: marcelo.id, source: "linkedin",  status: "CONTACTED",    temperature: "WARM",  fitScore: 70, lastContact: d(6) }),

    // QUALIFIED (6)
    mkLead({ name: "Andre Lourenco",     email: "andre@cyrela.com.br",             phone: "+55 11 96432-1098", title: "VP of Development",        companyId: coCyrela.id,      contactId: ctAndre.id,     ownerId: marcelo.id, source: "referral",  status: "QUALIFIED",    temperature: "HOT",   fitScore: 92, lastContact: d(1) }),
    mkLead({ name: "Luciana Santos",     email: "luciana@eztec.com.br",            phone: "+55 11 95321-0987", title: "Project Director",         companyId: coEZTEC.id,       contactId: ctLuciana.id,   ownerId: bianca.id,  source: "linkedin",  status: "QUALIFIED",    temperature: "HOT",   fitScore: 88, lastContact: d(2) }),
    mkLead({ name: "Felipe Rocha",       email: "felipe@patrimonialinvest.com.br", phone: "+55 21 94210-9876", title: "Managing Partner",         companyId: coPatrimonial.id, contactId: ctFelipe.id,    ownerId: marcelo.id, source: "web",       status: "QUALIFIED",    temperature: "HOT",   fitScore: 95, lastContact: d(1) }),
    mkLead({ name: "Aline Duarte",       email: "aline@sulamerica.com.br",         phone: "+55 21 99865-4321", title: "Real Estate Fund Manager", companyId: coSulAmerica.id,  contactId: ctAline.id,     ownerId: bianca.id,  source: "event",     status: "QUALIFIED",    temperature: "WARM",  fitScore: 82, lastContact: d(4) }),
    mkLead({ name: "Diego Moreira",      email: "diego@hemisferiosul.com.br",      phone: "+55 41 98754-3210", title: "Land Development Director",companyId: coHemisferio.id,  contactId: ctDiego.id,     ownerId: marcelo.id, source: "email",     status: "QUALIFIED",    temperature: "WARM",  fitScore: 76, lastContact: d(3) }),
    mkLead({ name: "Renata Campos",      email: "renata@mrv.com.br",              phone: "+55 31 98765-4321", title: "New Business Manager",     companyId: coMRV.id,         contactId: ctRenata.id,    ownerId: bianca.id,  source: "web",       status: "QUALIFIED",    temperature: "WARM",  fitScore: 80, lastContact: d(5) }),

    // CONVERTED (5)
    mkLead({ name: "Patricia Borges",    email: "patricia@tegra.com.br",           phone: "+55 11 97543-2109", title: "Procurement Manager",      companyId: coTegra.id,       contactId: ctPatricia.id,  ownerId: marcelo.id, source: "linkedin",  status: "CONVERTED",    temperature: "HOT",   fitScore: 94, lastContact: d(10) }),
    mkLead({ name: "Ricardo Teixeira",   email: "ricardo@patrimonialinvest.com.br",phone: "+55 21 90976-5432", title: "M&A Analyst",              companyId: coPatrimonial.id, contactId: ctRicardo.id,   ownerId: bianca.id,  source: "referral",  status: "CONVERTED",    temperature: "HOT",   fitScore: 90, lastContact: d(15) }),
    mkLead({ name: "Isabela Monteiro",   email: "isabela@cyrela.com.br",           phone: "+55 11 93209-8765", title: "Investment Analyst",       companyId: coCyrela.id,      contactId: ctIsabela.id,   ownerId: marcelo.id, source: "event",     status: "CONVERTED",    temperature: "HOT",   fitScore: 88, lastContact: d(20) }),
    mkLead({ name: "Marcus Vinicius",    email: "marcus@eztec.com.br",            phone: "+55 11 92198-7654", title: "Construction Coordinator", companyId: coEZTEC.id,       contactId: ctMarcus.id,    ownerId: bianca.id,  source: "web",       status: "CONVERTED",    temperature: "WARM",  fitScore: 83, lastContact: d(18) }),
    mkLead({ name: "Fernanda Lima",      email: "fernanda.lima@afgconstrutora.com.br",                        title: "Administrative Manager",   companyId: coAFG.id,         contactId: ctFernandaCt.id,ownerId: marcelo.id, source: "email",     status: "CONVERTED",    temperature: "WARM",  fitScore: 79, lastContact: d(25) }),

    // DISQUALIFIED (3)
    mkLead({ name: "Mariana Costa (2)",  email: "mariana2@votorantim.com.br",                                  title: "Intern",                   companyId: coVotorantim.id,  contactId: ctMariana.id,   ownerId: bianca.id,  source: "web",       status: "DISQUALIFIED", temperature: "COLD",  fitScore: 20 }),
    mkLead({ name: "Test Lead Nexus",    email: "test@nexuseng.com.br",                                       title: "Technical Assistant",      companyId: coNexus.id,       contactId: ctLeandro.id,   ownerId: marcelo.id, source: "email",     status: "DISQUALIFIED", temperature: "COLD",  fitScore: 25 }),
    mkLead({ name: "Planalto Generic",   email: "contato@planaltoterra.com.br",                                title: "Reception",                companyId: coPlanalto.id,    contactId: ctDaniel.id,    ownerId: bianca.id,  source: "web",       status: "DISQUALIFIED", temperature: "COLD",  fitScore: 18 }),
  ]);

  // ─── Accounts (6) — 2 as customers ─────────────────────────────────────────
  const mkAcct = (name: string, companyId: string, ownerId: string, isCustomer = false, becameCustomerAt?: Date, onboardingStatus = "PENDING") =>
    prisma.account.create({ data: { organizationId: O, name, companyId, ownerId, status: "active", isCustomer, becameCustomerAt, onboardingStatus } });

  const [acctCyrela, acctEZTEC, acctTegra, acctPatrimonial, acctMRV, acctAFG] = await Promise.all([
    mkAcct("Cyrela - Corporate",              coCyrela.id,       rodrigo.id,  true,  d(30), "COMPLETED"),
    mkAcct("EZTEC - Developments",            coEZTEC.id,        juliana.id,  true,  d(45), "IN_PROGRESS"),
    mkAcct("Tegra - Urban Projects",          coTegra.id,        rodrigo.id),
    mkAcct("Patrimonial Investments",         coPatrimonial.id,  juliana.id),
    mkAcct("MRV Engineering - SP Region",     coMRV.id,          rodrigo.id),
    mkAcct("AFG Construction",                coAFG.id,          juliana.id),
  ]);

  // ─── Pipeline & Stages ────────────────────────────────────────────────────
  const pipeline = await prisma.pipeline.create({ data: { organizationId: O, name: "Real Estate Pipeline", description: "Main sales pipeline for property developments" } });
  const stageData = [
    { name: "Discovery",     order: 1, color: "#3B82F6" },
    { name: "Qualification", order: 2, color: "#8B5CF6" },
    { name: "Proposal",      order: 3, color: "#F59E0B" },
    { name: "Negotiation",   order: 4, color: "#EF4444" },
    { name: "Closed Won",    order: 5, color: "#10B981" },
    { name: "Closed Lost",   order: 6, color: "#6B7280" },
  ];
  const stages: Record<string, string> = {};
  for (const s of stageData) {
    const st = await prisma.stage.create({ data: { pipelineId: pipeline.id, ...s } });
    stages[s.name] = st.id;
  }

  // ─── Opportunities (17) — owned by Closers (Rodrigo & Juliana) ────────────
  const mkOpp = (p: { title: string; description?: string; value: number; stage: string; stageId: string; probability: number; accountId: string; ownerId: string; ownerName: string; expectedCloseDate: Date; createdAt?: Date; primaryContactId?: string }) =>
    prisma.opportunity.create({ data: { organizationId: O, ...p } });

  const opps = await Promise.all([
    // DISCOVERY (3)
    mkOpp({ title: "Riviera Condominium - Phase 2",            description: "Expansion of the luxury condominium in the south zone, 120 units",              value: 2800000, stage: "DISCOVERY",     stageId: stages["Discovery"],     probability: 15, accountId: acctMRV.id,          ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: future(90), primaryContactId: ctEduardo.id }),
    mkOpp({ title: "Campinas Industrial Warehouse",             description: "Project of 3 logistics warehouses on the Campinas-Jundiai corridor",            value: 4500000, stage: "DISCOVERY",     stageId: stages["Discovery"],     probability: 10, accountId: acctAFG.id,          ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: future(120), primaryContactId: ctRoberto.id }),
    mkOpp({ title: "Serra Verde Land Development - Section C",  description: "Third phase of the residential land development in Goiania",                    value: 1200000, stage: "DISCOVERY",     stageId: stages["Discovery"],     probability: 20, accountId: acctAFG.id,          ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: future(75) }),

    // QUALIFICATION (3)
    mkOpp({ title: "Aurora Building - North Tower",             description: "25-story commercial tower on Faria Lima Avenue",                                value: 3200000, stage: "QUALIFICATION", stageId: stages["Qualification"], probability: 35, accountId: acctCyrela.id,       ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: future(60), primaryContactId: ctAndre.id }),
    mkOpp({ title: "Bosque Real Residential",                   description: "Gated community with 80 lots in Alphaville",                                   value: 1500000, stage: "QUALIFICATION", stageId: stages["Qualification"], probability: 40, accountId: acctEZTEC.id,        ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: future(50), primaryContactId: ctLuciana.id }),
    mkOpp({ title: "Parque das Palmeiras - Expansion",          description: "30 new units in the existing condominium in Barueri",                            value: 850000,  stage: "QUALIFICATION", stageId: stages["Qualification"], probability: 45, accountId: acctTegra.id,        ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: future(45), primaryContactId: ctGustavo.id }),

    // PROPOSAL (4)
    mkOpp({ title: "Pinheiros Land - Retrofit",                 description: "Retrofit of commercial building in Pinheiros for mixed-use",                     value: 2100000, stage: "PROPOSAL",      stageId: stages["Proposal"],      probability: 55, accountId: acctCyrela.id,       ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: future(30), primaryContactId: ctAndre.id }),
    mkOpp({ title: "Vila Olimpia Corporate",                    description: "Corporate floor plates in Vila Olimpia, 8,000 sqm",                              value: 3800000, stage: "PROPOSAL",      stageId: stages["Proposal"],      probability: 60, accountId: acctEZTEC.id,        ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: future(25), primaryContactId: ctLuciana.id }),
    mkOpp({ title: "Monte Alto Residential",                    description: "Affordable housing development with 200 units in Guarulhos",                     value: 950000,  stage: "PROPOSAL",      stageId: stages["Proposal"],      probability: 65, accountId: acctMRV.id,          ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: future(20), primaryContactId: ctRenata.id }),
    mkOpp({ title: "Logistics REIT - Initial Share",            description: "Participation in a logistics real estate investment trust",                       value: 500000,  stage: "PROPOSAL",      stageId: stages["Proposal"],      probability: 70, accountId: acctPatrimonial.id,  ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: future(15), primaryContactId: ctFelipe.id }),

    // NEGOTIATION (3)
    mkOpp({ title: "Horizonte Building - Block B",              description: "Second residential block in Morumbi, 60 apartments",                             value: 1800000, stage: "NEGOTIATION",   stageId: stages["Negotiation"],   probability: 80, accountId: acctCyrela.id,       ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: future(10), primaryContactId: ctAndre.id }),
    mkOpp({ title: "Osasco Mixed-Use Complex",                  description: "Mixed-use project with mall, residential tower, and hotel",                      value: 5000000, stage: "NEGOTIATION",   stageId: stages["Negotiation"],   probability: 75, accountId: acctTegra.id,        ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: future(14), primaryContactId: ctGustavo.id }),
    mkOpp({ title: "Commercial Lot Campinas Downtown",          description: "2,000 sqm commercial land in downtown Campinas",                                 value: 350000,  stage: "NEGOTIATION",   stageId: stages["Negotiation"],   probability: 85, accountId: acctPatrimonial.id,  ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: future(7),  primaryContactId: ctFelipe.id }),

    // CLOSED_WON (2)
    mkOpp({ title: "Riviera Condominium - Phase 1",             description: "First phase of the luxury condominium, 80 units delivered",                      value: 2200000, stage: "CLOSED_WON",    stageId: stages["Closed Won"],    probability: 100, accountId: acctCyrela.id,      ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: d(5),  createdAt: d(60), primaryContactId: ctAndre.id }),
    mkOpp({ title: "Santos Business Tower",                     description: "18-story commercial tower delivered in Santos",                                   value: 1650000, stage: "CLOSED_WON",    stageId: stages["Closed Won"],    probability: 100, accountId: acctEZTEC.id,       ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: d(12), createdAt: d(75), primaryContactId: ctLuciana.id }),

    // CLOSED_LOST (2)
    mkOpp({ title: "Vale das Flores Land Development",          description: "Lost to competitor on price per sqm",                                             value: 780000,  stage: "CLOSED_LOST",   stageId: stages["Closed Lost"],   probability: 0,  accountId: acctMRV.id,          ownerId: rodrigo.id,  ownerName: "Rodrigo Mendes",   expectedCloseDate: d(8),  createdAt: d(40) }),
    mkOpp({ title: "Consolacao Retrofit - Residential",         description: "Client withdrew due to regulatory issues with the city hall",                     value: 450000,  stage: "CLOSED_LOST",   stageId: stages["Closed Lost"],   probability: 0,  accountId: acctTegra.id,        ownerId: juliana.id,  ownerName: "Juliana Almeida",  expectedCloseDate: d(15), createdAt: d(50) }),
  ]);

  // ─── Tasks (22) — mix of statuses ─────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      // PENDING (6)
      { organizationId: O, title: "Send Aurora Building proposal to Cyrela",              type: "EMAIL",     priority: "HIGH",     status: "PENDING",     ownerId: juliana.id,  opportunityId: opps[3].id, dueDate: future(2) },
      { organizationId: O, title: "Schedule site visit to Pinheiros land",                type: "MEETING",   priority: "HIGH",     status: "PENDING",     ownerId: rodrigo.id,  opportunityId: opps[6].id, dueDate: future(3) },
      { organizationId: O, title: "Prepare feasibility study for Monte Alto",             type: "OTHER",     priority: "MEDIUM",   status: "PENDING",     ownerId: rodrigo.id,  opportunityId: opps[8].id, dueDate: future(5) },
      { organizationId: O, title: "Request environmental reports for Serra Verde",        type: "OTHER",     priority: "MEDIUM",   status: "PENDING",     ownerId: rodrigo.id,  opportunityId: opps[2].id, dueDate: future(7) },
      { organizationId: O, title: "Send Bosque Real catalog to EZTEC",                   type: "EMAIL",     priority: "LOW",      status: "PENDING",     ownerId: rodrigo.id,  opportunityId: opps[4].id, dueDate: future(4) },
      { organizationId: O, title: "Call Vanessa about luxury properties",                 type: "CALL",      priority: "MEDIUM",   status: "PENDING",     ownerId: bianca.id,   leadId: leads[9].id,       dueDate: future(1) },

      // OVERDUE (5)
      { organizationId: O, title: "Follow-up with Andre Lourenco about Horizonte Block B",type: "FOLLOW_UP", priority: "HIGH",     status: "PENDING",     ownerId: rodrigo.id,  opportunityId: opps[10].id, dueDate: d(2) },
      { organizationId: O, title: "Return call from Eduardo - MRV",                      type: "CALL",      priority: "HIGH",     status: "PENDING",     ownerId: marcelo.id,  leadId: leads[0].id,       dueDate: d(1) },
      { organizationId: O, title: "Send revised contract for Mixed-Use Complex",          type: "EMAIL",     priority: "CRITICAL", status: "PENDING",     ownerId: juliana.id,  opportunityId: opps[11].id, dueDate: d(3) },
      { organizationId: O, title: "Schedule meeting with SulAmerica about REIT",          type: "MEETING",   priority: "HIGH",     status: "PENDING",     ownerId: bianca.id,   leadId: leads[14].id,      dueDate: d(1) },
      { organizationId: O, title: "Review Parque das Palmeiras project description",      type: "OTHER",     priority: "MEDIUM",   status: "PENDING",     ownerId: juliana.id,  opportunityId: opps[5].id, dueDate: d(4) },

      // COMPLETED (7)
      { organizationId: O, title: "Send NDA to Tegra Development Corp",                  type: "EMAIL",     priority: "MEDIUM",   status: "COMPLETED",   ownerId: rodrigo.id,  opportunityId: opps[11].id, dueDate: d(7),  completedAt: d(6) },
      { organizationId: O, title: "Qualification call with Luciana Santos - EZTEC",       type: "CALL",      priority: "HIGH",     status: "COMPLETED",   ownerId: bianca.id,   leadId: leads[12].id,      dueDate: d(5),  completedAt: d(5) },
      { organizationId: O, title: "Prepare Riviera Condominium Phase 1 presentation",    type: "OTHER",     priority: "HIGH",     status: "COMPLETED",   ownerId: rodrigo.id,  opportunityId: opps[13].id, dueDate: d(15), completedAt: d(14) },
      { organizationId: O, title: "Site visit to Santos construction site",               type: "MEETING",   priority: "MEDIUM",   status: "COMPLETED",   ownerId: juliana.id,  opportunityId: opps[14].id, dueDate: d(20), completedAt: d(19) },
      { organizationId: O, title: "Prospecting call to Hemisferio Sul",                   type: "CALL",      priority: "MEDIUM",   status: "COMPLETED",   ownerId: marcelo.id,  leadId: leads[10].id,      dueDate: d(10), completedAt: d(9) },
      { organizationId: O, title: "Send price comparison to Felipe - Patrimonial",        type: "EMAIL",     priority: "HIGH",     status: "COMPLETED",   ownerId: bianca.id,   leadId: leads[13].id,      dueDate: d(8),  completedAt: d(7) },
      { organizationId: O, title: "Update CRM with Vivaz prospecting data",              type: "OTHER",     priority: "LOW",      status: "COMPLETED",   ownerId: marcelo.id,  leadId: leads[8].id,       dueDate: d(12), completedAt: d(11) },

      // IN_PROGRESS (4)
      { organizationId: O, title: "Finalize pricing for Commercial Lot Campinas",         type: "OTHER",     priority: "CRITICAL", status: "IN_PROGRESS", ownerId: rodrigo.id,  opportunityId: opps[12].id, dueDate: future(1) },
      { organizationId: O, title: "Draft Vila Olimpia Corporate proposal",                type: "OTHER",     priority: "HIGH",     status: "IN_PROGRESS", ownerId: juliana.id,  opportunityId: opps[7].id, dueDate: future(2) },
      { organizationId: O, title: "Qualify lead Diego Moreira - Hemisferio Sul",          type: "CALL",      priority: "MEDIUM",   status: "IN_PROGRESS", ownerId: marcelo.id,  leadId: leads[15].id,      dueDate: future(1) },
      { organizationId: O, title: "Analyze Industrial Warehouse land documentation",      type: "OTHER",     priority: "HIGH",     status: "IN_PROGRESS", ownerId: juliana.id,  opportunityId: opps[1].id, dueDate: future(3) },
    ],
  });

  // ─── Meetings (7) — 3 past, 4 future ─────────────────────────────────────
  await prisma.meeting.createMany({
    data: [
      // Past
      { organizationId: O, title: "Site visit to Riviera Condominium land",        ownerId: rodrigo.id,  contactId: ctAndre.id,    leadId: leads[11].id,                       startTime: d(10, 9),      endTime: d(10, 11),       location: "Rua das Palmeiras, 450 - South Zone SP",      notes: "Land approved. Client wants to start in 60 days.", attendees: JSON.stringify(["Andre Lourenco", "Isabela Monteiro"]) },
      { organizationId: O, title: "Aurora Building presentation for Cyrela",       ownerId: juliana.id,  contactId: ctAndre.id,    opportunityId: opps[3].id,                  startTime: d(5, 14),      endTime: d(5, 16),        location: "Virtual - Microsoft Teams",                    notes: "Presentation well received. Cyrela wants a formal proposal by Friday.", attendees: JSON.stringify(["Andre Lourenco", "Isabela Monteiro", "Technical Team"]) },
      { organizationId: O, title: "Q2 pipeline strategic alignment",               ownerId: carlos.id,   contactId: ctAndre.id,                                                startTime: d(3, 10),      endTime: d(3, 12),        location: "Meeting Room - Head Office",                   notes: "Quarterly review. Pipeline is healthy, focus on conversion.", attendees: JSON.stringify(["Carlos Drummond", "Fernanda Vasconcelos", "Rodrigo Mendes", "Juliana Almeida"]) },
      // Future
      { organizationId: O, title: "Mixed-Use Complex demo for Tegra",              ownerId: juliana.id,  contactId: ctGustavo.id,  opportunityId: opps[11].id,                 startTime: future(2, 14), endTime: future(2, 16),   location: "Virtual - Zoom",                               attendees: JSON.stringify(["Gustavo Pereira", "Patricia Borges"]) },
      { organizationId: O, title: "Vila Olimpia Corporate site visit",             ownerId: rodrigo.id,  contactId: ctLuciana.id,  opportunityId: opps[7].id,                  startTime: future(5, 9),  endTime: future(5, 12),   location: "R. Funchal, 418 - Vila Olimpia, Sao Paulo",    attendees: JSON.stringify(["Luciana Santos", "Marcus Vinicius", "Engineering Team"]) },
      { organizationId: O, title: "Meeting with SulAmerica about Logistics REIT",  ownerId: juliana.id,  contactId: ctAline.id,    opportunityId: opps[9].id,                  startTime: future(4, 15), endTime: future(4, 16),   location: "Virtual - Google Meet",                        attendees: JSON.stringify(["Aline Duarte", "Felipe Rocha"]) },
      { organizationId: O, title: "Final negotiation for Campinas Downtown Lot",   ownerId: rodrigo.id,  contactId: ctFelipe.id,   opportunityId: opps[12].id,                 startTime: future(1, 10), endTime: future(1, 11),   location: "Patrimonial Office - Campinas",                attendees: JSON.stringify(["Felipe Rocha"]) },
    ],
  });

  // ─── Activities (35) — spread across 30 days ─────────────────────────────
  await prisma.activity.createMany({
    data: [
      // Week 1 (recent)
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Revised Horizonte Building proposal",          body: "Sent updated proposal with 5% discount for closing by end of month.",                              creatorId: rodrigo.id,   leadId: leads[11].id, opportunityId: opps[10].id, createdAt: d(0, 9) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Qualification call Luciana Santos - EZTEC",    body: "45-minute call. Discussed Bosque Real requirements. Interest confirmed.",                           creatorId: bianca.id,    leadId: leads[12].id,                             createdAt: d(0, 14) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Champion confirmed - Cyrela",                  body: "Andre Lourenco confirmed budget approved for Q2. Moving to proposal.",                               creatorId: marcelo.id,   leadId: leads[11].id,                             createdAt: d(1, 10) },
      { organizationId: O, type: "WHATSAPP",     channel: "whatsapp", subject: "Update from Felipe - Patrimonial",             body: "Felipe confirmed interest in Logistics REIT. Wants a meeting next week.",                           creatorId: bianca.id,    leadId: leads[13].id,                             createdAt: d(1, 16) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: DISCOVERY -> QUALIFICATION",            body: "Aurora Building - North Tower advanced to Qualification.",                                           creatorId: juliana.id,   opportunityId: opps[3].id,                        createdAt: d(2, 11) },

      // Week 2
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "ROI analysis for Mixed-Use Complex",           body: "Sent ROI analysis projecting 22% return over 5 years for Tegra.",                                    creatorId: juliana.id,   opportunityId: opps[11].id,                       createdAt: d(4, 9) },
      { organizationId: O, type: "MEETING",      channel: "video",    subject: "Vila Olimpia technical presentation",          body: "Project demo with 6 EZTEC stakeholders. Strong interest in corporate floor plates.",                  creatorId: rodrigo.id,   opportunityId: opps[7].id,                        createdAt: d(5, 14) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Price per sqm negotiation - Cyrela",           body: "Andre requested 8% reduction per sqm. Counter-offer with 4% discount + extended terms.",              creatorId: rodrigo.id,   opportunityId: opps[10].id,                       createdAt: d(5, 10) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Risk - Serra Verde Land Development",          body: "Environmental permit pending for Section C. Awaiting IBAMA assessment.",                              creatorId: carlos.id,    opportunityId: opps[2].id,                        createdAt: d(6, 15) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Contract sent for Campinas Lot",               body: "Legal reviewed the Commercial Lot Campinas contract. Sent to Patrimonial.",                           creatorId: rodrigo.id,   opportunityId: opps[12].id,                       createdAt: d(6, 9) },

      // Week 3
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Prospecting MRV - Eduardo",                    body: "First call with Eduardo Martins. Interested in partnership for Riviera Phase 2.",                     creatorId: marcelo.id,   leadId: leads[0].id,                              createdAt: d(8, 11) },
      { organizationId: O, type: "WHATSAPP",     channel: "whatsapp", subject: "Confirmation from Priscila - Vivaz",           body: "Priscila confirmed Vivaz wants to expand portfolio. Schedule presentation.",                          creatorId: marcelo.id,   leadId: leads[8].id,                              createdAt: d(8, 16) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Logistics REIT proposal",                      body: "Sent participation proposal for REIT with projected yield of 0.85% per month.",                       creatorId: juliana.id,   opportunityId: opps[9].id,                        createdAt: d(10, 9) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: PROPOSAL -> NEGOTIATION",               body: "Osasco Mixed-Use Complex advanced to Negotiation.",                                                   creatorId: juliana.id,   opportunityId: opps[11].id,                       createdAt: d(10, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Follow-up Gustavo - Tegra",                    body: "Gustavo wants to include a hotel in the project. Value may increase to R$6M.",                        creatorId: juliana.id,   leadId: leads[5].id,   opportunityId: opps[11].id, createdAt: d(12, 14) },

      // Week 4
      { organizationId: O, type: "MEETING",      channel: "video",    subject: "Executive alignment meeting",                  body: "Monthly pipeline review with leadership. Focus on proposal conversion.",                              creatorId: carlos.id,                                                      createdAt: d(14, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Negotiation with Aline - SulAmerica",          body: "Aline negotiating REIT management fee. Requested reduction to 0.8%.",                                 creatorId: juliana.id,   leadId: leads[14].id,                             createdAt: d(15, 14) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Welcome package Cyrela - Riviera Phase 1",     body: "Sent onboarding package after closing Phase 1.",                                                      creatorId: rodrigo.id,   opportunityId: opps[13].id,                       createdAt: d(18, 9) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Forecast update",                              body: "Q2 forecast updated: commit R$4.2M, best case R$7.5M.",                                               creatorId: fernanda.id,                                                    createdAt: d(20, 16) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Prospecting AFG - Roberto",                    body: "Roberto from AFG interested in land development in Goiania. Site visit scheduled.",                    creatorId: marcelo.id,   leadId: leads[2].id,                              createdAt: d(22, 11) },

      // Older / stage changes / wins / losses
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: NEGOTIATION -> CLOSED_WON",             body: "Riviera Condominium Phase 1 closed for R$2,200,000.",                                                  creatorId: rodrigo.id,   opportunityId: opps[13].id,                       createdAt: d(5, 17) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: PROPOSAL -> CLOSED_WON",                body: "Santos Business Tower closed for R$1,650,000.",                                                       creatorId: juliana.id,   opportunityId: opps[14].id,                       createdAt: d(12, 17) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Lost deal post-mortem",                         body: "Vale das Flores Land Development lost to competitor. Price per sqm was 15% above market.",              creatorId: rodrigo.id,                                                     createdAt: d(8, 10) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: NEGOTIATION -> CLOSED_LOST",             body: "Consolacao Retrofit lost due to regulatory issues.",                                                   creatorId: juliana.id,   opportunityId: opps[16].id,                       createdAt: d(15, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Referral from Andre Lourenco",                  body: "Andre referred Felipe Rocha from Patrimonial. Hot lead for REITs.",                                    creatorId: marcelo.id,   leadId: leads[13].id,                             createdAt: d(25, 14) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Weekly SDR standup",                            body: "Marcelo: 4 qualified leads. Bianca: 3 demos scheduled. Pipeline growing.",                             creatorId: carlos.id,                                                      createdAt: d(3, 9) },

      // Additional activities for volume
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Monte Alto Residential sales materials",        body: "Sent sales book with floor plans, price list, and payment terms.",                                     creatorId: rodrigo.id,   opportunityId: opps[8].id,                        createdAt: d(7, 9) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Cold call Diego Moreira",                       body: "First contact with Diego. Hemisferio Sul wants to expand to Parana state.",                            creatorId: marcelo.id,   leadId: leads[15].id,                             createdAt: d(9, 11) },
      { organizationId: O, type: "WHATSAPP",     channel: "whatsapp", subject: "Document received - Camila Warehouse",         body: "Camila sent the land blueprint for Campinas. 45,000 sqm available.",                                   creatorId: marcelo.id,   leadId: leads[6].id,                              createdAt: d(11, 15) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Parque das Palmeiras proposal",                 body: "Sent final proposal for Parque das Palmeiras expansion - Tegra.",                                      creatorId: juliana.id,   opportunityId: opps[5].id,                        createdAt: d(13, 9) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Vila Olimpia competitor analysis",              body: "Competitor offering sqm at R$28k in the area. Our price is at R$32k. Evaluate adjustment.",             creatorId: juliana.id,   opportunityId: opps[7].id,                        createdAt: d(16, 11) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Callback from Beatriz - Hemisferio",           body: "Beatriz returned call. Interested in partnership for land development in Londrina.",                    creatorId: marcelo.id,   leadId: leads[10].id,                             createdAt: d(19, 14) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: QUALIFICATION -> PROPOSAL",              body: "Pinheiros Land - Retrofit advanced to Proposal.",                                                     creatorId: rodrigo.id,   opportunityId: opps[6].id,                        createdAt: d(21, 10) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "ADIT Invest event invitation",                  body: "Invitation for Aexion Realty booth at ADIT Invest 2026.",                                              creatorId: fernanda.id,                                                    createdAt: d(24, 8) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Monthly target achieved",                       body: "Closers team reached 115% of monthly target. Highlight: Rodrigo with 2 closings.",                     creatorId: carlos.id,                                                      createdAt: d(28, 16) },
    ],
  });

  // ─── Inbox Messages (10) ──────────────────────────────────────────────────
  await prisma.inboxMessage.createMany({
    data: [
      { organizationId: O, channel: "EMAIL",    sender: "andre@cyrela.com.br",             subject: "Re: Horizonte Building Proposal",     body: "I received the proposal. I will discuss it with our board at the next meeting. Can you schedule for Tuesday?",       isRead: false, createdAt: d(0, 19) },
      { organizationId: O, channel: "WHATSAPP", sender: "felipe@patrimonialinvest.com.br", subject: "Campinas Lot - Question",             body: "Felipe, does the land have individual registration or is it part of a larger plot?",                                  isRead: false, createdAt: d(0, 15) },
      { organizationId: O, channel: "EMAIL",    sender: "gustavo@tegra.com.br",            subject: "Mixed-Use Complex - Scope Change",    body: "We want to include a convention center. Can you update the proposal?",                                                isRead: false, createdAt: d(0, 7) },
      { organizationId: O, channel: "EMAIL",    sender: "luciana@eztec.com.br",            subject: "Vila Olimpia Documentation",          body: "Attached is the land documentation and neighborhood impact study. Awaiting your response.",                           isRead: true,  createdAt: d(1, 10) },
      { organizationId: O, channel: "CALL",     sender: "eduardo@mrv.com.br",              subject: "Missed call",                         body: "Eduardo called to discuss a partnership on Riviera Phase 2. Please call back.",                                       isRead: false, createdAt: d(1, 16) },
      { organizationId: O, channel: "EMAIL",    sender: "aline@sulamerica.com.br",         subject: "Logistics REIT - Interest",           body: "We have R$50M allocated for new logistics REITs this quarter. Let's talk?",                                           isRead: true,  createdAt: d(2, 9) },
      { organizationId: O, channel: "WHATSAPP", sender: "camila@galpaologistico.com.br",   subject: "Campinas land blueprint",             body: "Here is the updated land blueprint. 45,000 sqm with direct highway access.",                                          isRead: false, createdAt: d(2, 15) },
      { organizationId: O, channel: "INTERNAL", sender: "system",                          subject: "Weekly pipeline summary",             body: "Pipeline grew 8% this week. 3 new qualified leads, 1 deal advanced to negotiation.",                                   isRead: false, createdAt: d(0, 8) },
      { organizationId: O, channel: "EMAIL",    sender: "priscila@vivaz.com.br",           subject: "Vivaz portfolio expansion",           body: "We are expanding to the interior of Sao Paulo state. We would like a presentation of your solutions.",                 isRead: false, createdAt: d(0, 7) },
      { organizationId: O, channel: "EMAIL",    sender: "roberto@afgconstrutora.com.br",   subject: "Goiania Land Development",            body: "We are interested in the Serra Verde land development. Can we schedule a site visit?",                                 isRead: false, createdAt: d(1, 11) },
    ],
  });

  // ─── Integrations (12) ────────────────────────────────────────────────────
  const integrationNames = ["Gmail", "Google Calendar", "Outlook", "WhatsApp", "Slack", "HubSpot", "Salesforce", "Zapier", "Stripe", "Zoom", "Microsoft Teams", "Jira"];
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

  // ─── Playbooks (3) — Real Estate specific ─────────────────────────────────
  const pb1 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "High-End Development Playbook",
      description: "Complete guide for selling developments above R$2M to tier 1 developers",
      segment: "Enterprise",
      stage: "Discovery",
      conversionRate: 62,
      usage: 187,
    },
  });
  const pb2 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "Land Development & Lots Playbook",
      description: "Sales process for residential land developments and commercial lots",
      segment: "Mid-Market",
      stage: "Qualification",
      conversionRate: 48,
      usage: 134,
    },
  });
  const pb3 = await prisma.playbook.create({
    data: {
      organizationId: O,
      name: "REIT & Real Estate Investments Playbook",
      description: "Approach for real estate investment trusts and institutional investors",
      segment: "Enterprise",
      stage: "Discovery",
      conversionRate: 55,
      usage: 89,
    },
  });

  // Playbook Steps
  await prisma.playbookStep.createMany({
    data: [
      // Playbook 1 steps
      { playbookId: pb1.id, order: 1, title: "Research the developer",             description: "Review portfolio, recent launches, and market positioning." },
      { playbookId: pb1.id, order: 2, title: "First executive contact",            description: "Call VP or Director with a personalized value proposition." },
      { playbookId: pb1.id, order: 3, title: "Technical site visit",               description: "Schedule in-person site visit with the client's technical team." },
      { playbookId: pb1.id, order: 4, title: "Detailed commercial proposal",       description: "Send proposal with feasibility study, floor plans, and timeline." },
      { playbookId: pb1.id, order: 5, title: "Negotiation and closing",            description: "Align commercial terms, legal review, and sign contract." },
      // Playbook 2 steps
      { playbookId: pb2.id, order: 1, title: "Land analysis",                      description: "Verify registration, zoning, topography, and access routes." },
      { playbookId: pb2.id, order: 2, title: "Local market study",                 description: "Map demand, competition, and average price per sqm in the region." },
      { playbookId: pb2.id, order: 3, title: "Project presentation",               description: "Showcase master plan, planned infrastructure, and differentiators." },
      { playbookId: pb2.id, order: 4, title: "Commercial terms",                   description: "Present price list, payment options, and timelines." },
      // Playbook 3 steps
      { playbookId: pb3.id, order: 1, title: "Identify investor profile",          description: "Understand risk appetite, average ticket, and investment horizon." },
      { playbookId: pb3.id, order: 2, title: "Present investment thesis",           description: "Build a deck with market analysis, projections, and comparisons." },
      { playbookId: pb3.id, order: 3, title: "Asset due diligence",                description: "Provide documentation and appraisal reports for the fund's properties." },
      { playbookId: pb3.id, order: 4, title: "Structuring and compliance",          description: "Align with legal and compliance for formalization." },
    ],
  });

  // ─── Insights (6) ─────────────────────────────────────────────────────────
  await prisma.insight.createMany({
    data: [
      { organizationId: O, category: "pipeline",     title: "High-value deals without activity",         description: "3 opportunities above R$2M have had no activity in the last 5 days.",                           impact: "HIGH",   confidence: 92, suggestedAction: "Schedule check-in with opportunity owners.",                  opportunityId: opps[1].id },
      { organizationId: O, category: "engagement",   title: "Response time improving",                   description: "Average response time dropped 22% this month, from 4h to 3.1h.",                               impact: "MEDIUM", confidence: 87, suggestedAction: "Maintain current cadence. Share best practices with team." },
      { organizationId: O, category: "risk",          title: "Environmental risk Serra Verde",             description: "Pending IBAMA assessment may delay Serra Verde land development by 90 days.",                   impact: "HIGH",   confidence: 95, suggestedAction: "Contact environmental attorney and prepare contingency plan.",  opportunityId: opps[2].id },
      { organizationId: O, category: "performance",   title: "Highlight: Rodrigo Mendes",                 description: "Rodrigo closed R$3.85M this quarter with a 60% conversion rate.",                              impact: "LOW",    confidence: 98, suggestedAction: "Schedule knowledge-sharing session." },
      { organizationId: O, category: "pipeline",     title: "Pipeline concentration in Cyrela",          description: "45% of the active pipeline is concentrated in a single client (Cyrela).",                       impact: "HIGH",   confidence: 90, suggestedAction: "Diversify pipeline with active prospecting of new clients.",     leadId: leads[11].id },
      { organizationId: O, category: "engagement",   title: "Cold leads without re-engagement",          description: "8 leads with COLD temperature have not been contacted in over 15 days.",                       impact: "MEDIUM", confidence: 85, suggestedAction: "Create email re-engagement campaign." },
    ],
  });

  // ─── Recommendations (5) ──────────────────────────────────────────────────
  await prisma.recommendation.createMany({
    data: [
      { organizationId: O, action: "Schedule in-person visit to Industrial Warehouse Campinas land",  reason: "R$4.5M deal stuck in Discovery for 15 days. Site visit can accelerate qualification.", priority: "HIGH",   opportunityId: opps[1].id },
      { organizationId: O, action: "Send Riviera Phase 1 case study to MRV lead",                     reason: "Eduardo Martins is a NEW lead with fitScore 72. Similar case study can warm up the lead.",  priority: "MEDIUM", leadId: leads[0].id },
      { organizationId: O, action: "Re-engage COLD leads with real estate market newsletter",          reason: "5 COLD leads with no contact for over 10 days. Value content can reactivate interest.",     priority: "LOW" },
      { organizationId: O, action: "Prepare counter-proposal for Osasco Mixed-Use Complex",            reason: "Tegra requested scope change. Without response in 3 days, R$5M deal may cool down.",       priority: "CRITICAL", opportunityId: opps[11].id },
      { organizationId: O, action: "Schedule meeting between Fernanda and Andre Lourenco (Cyrela)",    reason: "Pipeline heavily concentrated in Cyrela. Executive alignment can strengthen partnership.",   priority: "HIGH",   leadId: leads[11].id },
    ],
  });

  // ─── Forecast Snapshots ───────────────────────────────────────────────────
  await prisma.forecastSnapshot.createMany({
    data: [
      { organizationId: O, quarter: "Q1", year: 2026, commit: 3850000,  bestCase: 5200000,  pipeline: 18000000, target: 5000000 },
      { organizationId: O, quarter: "Q2", year: 2026, commit: 4200000,  bestCase: 7500000,  pipeline: 24000000, target: 6000000 },
    ],
  });

  // ─── Audit Logs (5) ──────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { organizationId: O, userId: rodrigo.id,  action: "opportunity.closed_won",   objectType: "Opportunity", objectId: opps[13].id, details: "Riviera Condominium Phase 1 closed for R$2,200,000",       source: "web", createdAt: d(5) },
      { organizationId: O, userId: juliana.id,   action: "opportunity.closed_won",   objectType: "Opportunity", objectId: opps[14].id, details: "Santos Business Tower closed for R$1,650,000",             source: "web", createdAt: d(12) },
      { organizationId: O, userId: marcelo.id,   action: "lead.status_changed",      objectType: "Lead",        objectId: leads[11].id, details: "Status changed from CONTACTED to QUALIFIED",               source: "web", createdAt: d(15) },
      { organizationId: O, userId: bianca.id,    action: "lead.status_changed",      objectType: "Lead",        objectId: leads[12].id, details: "Status changed from NEW to QUALIFIED",                     source: "web", createdAt: d(18) },
      { organizationId: O, userId: fernanda.id,  action: "settings.modules_updated", objectType: "Organization", objectId: org.id,      details: "Enabled modules: commercial, data, reports, automation, post_sale, playbooks", source: "admin", createdAt: d(30) },
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

  console.log("Real Estate seed completed successfully!");
  console.log(`
  Summary:
  - 1 Organization: Aexion Realty Group
  - 4 Teams (SDR, Closers, Management, Leadership), 6 Users (ADMIN, 2 SDRs, 2 Closers, MANAGER)
  - 15 Companies (real estate industry), 22 Contacts
  - 25 Leads (NEW:5, CONTACTED:6, QUALIFIED:6, CONVERTED:5, DISQUALIFIED:3)
  - 6 Accounts (2 customers)
  - 17 Opportunities (DISCOVERY:3, QUALIFICATION:3, PROPOSAL:4, NEGOTIATION:3, WON:2, LOST:2)
  - 22 Tasks (PENDING:6, OVERDUE:5, COMPLETED:7, IN_PROGRESS:4)
  - 7 Meetings (3 past, 4 future)
  - 35 Activities (spread across 28 days)
  - 10 Inbox Messages
  - 12 Integrations, 3 Playbooks (with steps), 6 Insights, 5 Recommendations
  - 2 Forecast Snapshots

  Login credentials:
  - marcelo@aexionrealty.com.br / password123 (SDR)
  - bianca@aexionrealty.com.br / password123 (SDR)
  - rodrigo@aexionrealty.com.br / password123 (CLOSER)
  - juliana@aexionrealty.com.br / password123 (CLOSER)
  - carlos@aexionrealty.com.br / password123 (MANAGER)
  - fernanda@aexionrealty.com.br / password123 (ADMIN)
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
