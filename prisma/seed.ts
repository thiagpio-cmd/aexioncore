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
  console.log("Starting seed...");

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

  // ─── Organization + Teams ───────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: "Aexion Inc",
      slug: "aexion-inc",
      enabledModules: JSON.stringify(["commercial", "data", "reports", "playbooks"]),
    },
  });
  const O = org.id;

  const sdrTeam = await prisma.team.create({ data: { organizationId: O, name: "Sales Development", description: "SDR team" } });
  const closerTeam = await prisma.team.create({ data: { organizationId: O, name: "Sales Closing", description: "Closer team" } });
  const mgrTeam = await prisma.team.create({ data: { organizationId: O, name: "Sales Management", description: "Management" } });

  // ─── Users (7) — same emails for login compatibility ────────────────────────
  const pw = await bcrypt.hash("aexion123", 10);
  const mkUser = (email: string, name: string, role: string, workspace: string, teamId: string | null) =>
    prisma.user.create({ data: { organizationId: O, teamId, email, name, password: pw, role, workspace, isActive: true } });

  const ana       = await mkUser("ana@aexion.io",       "Ana Silva",          "ADMIN",    "EXECUTIVE", mgrTeam.id);
  const rafael    = await mkUser("rafael@aexion.io",    "Rafael Santos",      "SDR",      "SDR",       sdrTeam.id);
  const joao      = await mkUser("joao@aexion.io",      "Joao Ferreira",      "SDR",      "SDR",       sdrTeam.id);
  const lucas     = await mkUser("lucas@aexion.io",     "Lucas Costa",        "CLOSER",   "CLOSER",    closerTeam.id);
  const camila    = await mkUser("camila@aexion.io",    "Camila Oliveira",    "CLOSER",   "CLOSER",    closerTeam.id);
  const patricia  = await mkUser("patricia@aexion.io",  "Patricia Lopes",     "MANAGER",  "MANAGER",   mgrTeam.id);
  const fernanda  = await mkUser("fernanda@aexion.io",  "Fernanda Dias",      "DIRECTOR", "EXECUTIVE", mgrTeam.id);

  // ─── Companies (8) ──────────────────────────────────────────────────────────
  const mkCo = (name: string, industry: string, size: string, website: string) =>
    prisma.company.create({ data: { organizationId: O, name, industry, size, website } });

  const [coTechNova, coCloudFirst, coDataFlow, coSecureNet, coAILabs, coGlobalRetail, coFinanceHub, coLogiPrime] = await Promise.all([
    mkCo("TechNova Solutions",      "Technology",       "201-500",  "https://technova.io"),
    mkCo("CloudFirst",              "Cloud Services",   "51-200",   "https://cloudfirst.com"),
    mkCo("DataFlow Analytics",      "Data & Analytics", "11-50",    "https://dataflow.io"),
    mkCo("SecureNet Systems",       "Cybersecurity",    "201-500",  "https://securenet.io"),
    mkCo("AI Innovations Lab",      "Artificial Intel", "11-50",    "https://aiinnov.io"),
    mkCo("Global Retail Strategic", "Retail",           "501-1000", "https://globalretail.com"),
    mkCo("FinanceHub",              "Financial Serv.",  "51-200",   "https://financehub.com"),
    mkCo("LogiPrime",               "Logistics",        "201-500",  "https://logiprime.com"),
  ]);

  // ─── Contacts (10) ─────────────────────────────────────────────────────────
  const mkContact = (name: string, email: string, title: string, companyId: string, phone?: string) =>
    prisma.contact.create({ data: { organizationId: O, name, email, title, companyId, phone } });

  const [ctJohn, ctSarah, ctMichael, ctEmma, ctDavid, ctLisa, ctRodrigo, ctFernandaCt, ctPaulo, ctMariana] = await Promise.all([
    mkContact("John Smith",       "john.smith@technova.io",     "CTO",                 coTechNova.id,      "+55 11 98765-4321"),
    mkContact("Sarah Chen",       "sarah.chen@cloudfirst.com",  "VP Engineering",      coCloudFirst.id,    "+55 21 97654-3210"),
    mkContact("Michael Rivera",   "michael@dataflow.io",        "Head of Data",        coDataFlow.id),
    mkContact("Emma Rodriguez",   "emma@securenet.io",          "Security Director",   coSecureNet.id,     "+55 31 96543-2109"),
    mkContact("David Kim",        "david@aiinnov.io",           "CEO",                 coAILabs.id,        "+55 41 95432-1098"),
    mkContact("Lisa Wang",        "lisa@globalretail.com",      "COO",                 coGlobalRetail.id),
    mkContact("Rodrigo Almeida",  "rodrigo@financehub.com",     "CFO",                 coFinanceHub.id,    "+55 11 94321-0987"),
    mkContact("Fernanda Costa",   "fernanda@logiprime.com",     "VP Operations",       coLogiPrime.id),
    mkContact("Paulo Henrique",   "paulo@technova.io",          "Product Manager",     coTechNova.id),
    mkContact("Mariana Souza",    "mariana@cloudfirst.com",     "Engineering Manager", coCloudFirst.id),
  ]);

  // ─── Leads (12) — owned by SDRs (Rafael & Joao) ────────────────────────────
  //
  // Status distribution: NEW(3), CONTACTED(3), QUALIFIED(3), CONVERTED(2), DISQUALIFIED(1)
  // Temperature: HOT(4), WARM(4), COLD(3), COOL(1)
  // Sources: linkedin(3), web(3), email(2), referral(2), event(2)
  //
  const mkLead = (p: { name: string; email: string; phone?: string; title?: string; companyId: string; contactId: string; ownerId: string; source: string; status: string; temperature: string; fitScore: number; lastContact?: Date }) =>
    prisma.lead.create({ data: { organizationId: O, ...p } });

  const leads = await Promise.all([
    // NEW (3)
    mkLead({ name: "John Smith",       email: "john.smith@technova.io",    phone: "+55 11 98765-4321", title: "CTO",              companyId: coTechNova.id,     contactId: ctJohn.id,       ownerId: rafael.id,  source: "linkedin",  status: "NEW",          temperature: "WARM",  fitScore: 78 }),
    mkLead({ name: "Rodrigo Almeida",  email: "rodrigo@financehub.com",   phone: "+55 11 94321-0987", title: "CFO",              companyId: coFinanceHub.id,   contactId: ctRodrigo.id,    ownerId: joao.id,    source: "web",       status: "NEW",          temperature: "COLD",  fitScore: 55 }),
    mkLead({ name: "Fernanda Costa",   email: "fernanda@logiprime.com",                               title: "VP Operations",    companyId: coLogiPrime.id,    contactId: ctFernandaCt.id, ownerId: rafael.id,  source: "event",     status: "NEW",          temperature: "COLD",  fitScore: 48 }),
    // CONTACTED (3)
    mkLead({ name: "Sarah Chen",       email: "sarah.chen@cloudfirst.com", phone: "+55 21 97654-3210", title: "VP Engineering",   companyId: coCloudFirst.id,   contactId: ctSarah.id,      ownerId: joao.id,    source: "web",       status: "CONTACTED",    temperature: "WARM",  fitScore: 82, lastContact: d(2) }),
    mkLead({ name: "Michael Rivera",   email: "michael@dataflow.io",                                  title: "Head of Data",     companyId: coDataFlow.id,     contactId: ctMichael.id,    ownerId: rafael.id,  source: "linkedin",  status: "CONTACTED",    temperature: "WARM",  fitScore: 70, lastContact: d(5) }),
    mkLead({ name: "Paulo Henrique",   email: "paulo@technova.io",                                    title: "Product Manager",  companyId: coTechNova.id,     contactId: ctPaulo.id,      ownerId: joao.id,    source: "email",     status: "CONTACTED",    temperature: "COOL",  fitScore: 65, lastContact: d(12) }),
    // QUALIFIED (3)
    mkLead({ name: "Emma Rodriguez",   email: "emma@securenet.io",        phone: "+55 31 96543-2109", title: "Security Director", companyId: coSecureNet.id,    contactId: ctEmma.id,       ownerId: rafael.id,  source: "referral",  status: "QUALIFIED",    temperature: "HOT",   fitScore: 92, lastContact: d(1) }),
    mkLead({ name: "David Kim",        email: "david@aiinnov.io",         phone: "+55 41 95432-1098", title: "CEO",              companyId: coAILabs.id,       contactId: ctDavid.id,      ownerId: joao.id,    source: "linkedin",  status: "QUALIFIED",    temperature: "HOT",   fitScore: 88, lastContact: d(3) }),
    mkLead({ name: "Mariana Souza",    email: "mariana@cloudfirst.com",                                title: "Eng Manager",      companyId: coCloudFirst.id,   contactId: ctMariana.id,    ownerId: rafael.id,  source: "web",       status: "QUALIFIED",    temperature: "WARM",  fitScore: 76, lastContact: d(4) }),
    // CONVERTED (2)
    mkLead({ name: "Lisa Wang",        email: "lisa@globalretail.com",                                 title: "COO",              companyId: coGlobalRetail.id, contactId: ctLisa.id,       ownerId: joao.id,    source: "event",     status: "CONVERTED",    temperature: "HOT",   fitScore: 95, lastContact: d(10) }),
    mkLead({ name: "John Smith (TN)",  email: "john.smith2@technova.io",                               title: "CTO",              companyId: coTechNova.id,     contactId: ctJohn.id,       ownerId: rafael.id,  source: "referral",  status: "CONVERTED",    temperature: "HOT",   fitScore: 97, lastContact: d(15) }),
    // DISQUALIFIED (1)
    mkLead({ name: "Test User",        email: "test@example.com",                                      title: "Intern",           companyId: coDataFlow.id,     contactId: ctMichael.id,    ownerId: joao.id,    source: "email",     status: "DISQUALIFIED", temperature: "COLD",  fitScore: 22 }),
  ]);

  // ─── Accounts (6) — 2 as customers ─────────────────────────────────────────
  const mkAcct = (name: string, companyId: string, ownerId: string, isCustomer = false, becameCustomerAt?: Date) =>
    prisma.account.create({ data: { organizationId: O, name, companyId, ownerId, status: "active", isCustomer, becameCustomerAt } });

  const [acctTechNova, acctCloudFirst, acctSecureNet, acctGlobalRetail, acctDataFlow, acctAILabs] = await Promise.all([
    mkAcct("TechNova Enterprise",        coTechNova.id,     lucas.id,  true,  d(45)),
    mkAcct("CloudFirst Growth",          coCloudFirst.id,   camila.id),
    mkAcct("SecureNet Enterprise",       coSecureNet.id,    camila.id),
    mkAcct("Global Retail Strategic",    coGlobalRetail.id, lucas.id,  true,  d(30)),
    mkAcct("DataFlow SMB",               coDataFlow.id,     lucas.id),
    mkAcct("AI Labs Innovation",         coAILabs.id,       camila.id),
  ]);

  // ─── Pipeline & Stages ──────────────────────────────────────────────────────
  const pipeline = await prisma.pipeline.create({ data: { organizationId: O, name: "Default Pipeline" } });
  const stageData = [
    { name: "Discovery",     order: 1 },
    { name: "Qualification", order: 2 },
    { name: "Proposal",      order: 3 },
    { name: "Negotiation",   order: 4 },
    { name: "Closed Won",    order: 5 },
    { name: "Closed Lost",   order: 6 },
  ];
  const stages: Record<string, string> = {};
  for (const s of stageData) {
    const st = await prisma.stage.create({ data: { pipelineId: pipeline.id, ...s } });
    stages[s.name] = st.id;
  }

  // ─── Opportunities (12) — owned by Closers (Lucas & Camila) ─────────────────
  //
  // TARGET METRICS:
  // Active Pipeline: ~R$2.53M | Won: R$580K | Win Rate: 67% (2/3)
  // Forecast Commit (≥70%): ~R$1.05M | At Risk (prob<40): 3 | Avg Deal: ~R$281K
  //
  const mkOpp = (p: { title: string; value: number; stage: string; stageId: string; probability: number; accountId: string; ownerId: string; ownerName: string; expectedCloseDate: Date; createdAt?: Date; primaryContactId?: string }) =>
    prisma.opportunity.create({ data: { organizationId: O, ...p } });

  const opps = await Promise.all([
    // DISCOVERY (2) — value: 350K, prob < 40
    mkOpp({ title: "SecureNet - Full Platform",     value: 200000, stage: "DISCOVERY",     stageId: stages["Discovery"],     probability: 20, accountId: acctSecureNet.id,    ownerId: camila.id, ownerName: "Camila Oliveira", expectedCloseDate: future(75), primaryContactId: ctEmma.id }),
    mkOpp({ title: "AI Labs - ML Suite",             value: 150000, stage: "DISCOVERY",     stageId: stages["Discovery"],     probability: 15, accountId: acctAILabs.id,       ownerId: lucas.id,  ownerName: "Lucas Costa",     expectedCloseDate: future(90), primaryContactId: ctDavid.id }),
    // QUALIFICATION (3) — value: 620K, prob 35-50
    mkOpp({ title: "CloudFirst - Growth Plan",       value: 280000, stage: "QUALIFICATION", stageId: stages["Qualification"], probability: 45, accountId: acctCloudFirst.id,   ownerId: camila.id, ownerName: "Camila Oliveira", expectedCloseDate: future(50), primaryContactId: ctSarah.id }),
    mkOpp({ title: "DataFlow - Analytics Pro",       value: 180000, stage: "QUALIFICATION", stageId: stages["Qualification"], probability: 40, accountId: acctDataFlow.id,     ownerId: lucas.id,  ownerName: "Lucas Costa",     expectedCloseDate: future(45), primaryContactId: ctMichael.id }),
    mkOpp({ title: "AI Labs - Data Pipeline",        value: 160000, stage: "QUALIFICATION", stageId: stages["Qualification"], probability: 35, accountId: acctAILabs.id,       ownerId: camila.id, ownerName: "Camila Oliveira", expectedCloseDate: future(60) }),
    // PROPOSAL (3) — value: 930K, prob 55-70
    mkOpp({ title: "TechNova - Enterprise Deal",     value: 450000, stage: "PROPOSAL",      stageId: stages["Proposal"],      probability: 65, accountId: acctTechNova.id,     ownerId: lucas.id,  ownerName: "Lucas Costa",     expectedCloseDate: future(25), primaryContactId: ctJohn.id }),
    mkOpp({ title: "Global Retail - Full Suite",     value: 380000, stage: "PROPOSAL",      stageId: stages["Proposal"],      probability: 60, accountId: acctGlobalRetail.id, ownerId: camila.id, ownerName: "Camila Oliveira", expectedCloseDate: future(20), primaryContactId: ctLisa.id }),
    mkOpp({ title: "SecureNet - Compliance Module",  value: 100000, stage: "PROPOSAL",      stageId: stages["Proposal"],      probability: 70, accountId: acctSecureNet.id,    ownerId: lucas.id,  ownerName: "Lucas Costa",     expectedCloseDate: future(15) }),
    // NEGOTIATION (2) — value: 630K, prob 75-85
    mkOpp({ title: "TechNova - Support Tier Upgrade", value: 130000, stage: "NEGOTIATION",  stageId: stages["Negotiation"],   probability: 85, accountId: acctTechNova.id,     ownerId: lucas.id,  ownerName: "Lucas Costa",     expectedCloseDate: future(7) }),
    mkOpp({ title: "CloudFirst - API Gateway",        value: 500000, stage: "NEGOTIATION",  stageId: stages["Negotiation"],   probability: 78, accountId: acctCloudFirst.id,   ownerId: camila.id, ownerName: "Camila Oliveira", expectedCloseDate: future(12), primaryContactId: ctSarah.id }),
    // CLOSED_WON (2) — value: 580K
    mkOpp({ title: "Global Retail - Phase 1",        value: 320000, stage: "CLOSED_WON",    stageId: stages["Closed Won"],    probability: 100, accountId: acctGlobalRetail.id, ownerId: lucas.id,  ownerName: "Lucas Costa",    expectedCloseDate: d(5),  createdAt: d(60), primaryContactId: ctLisa.id }),
    mkOpp({ title: "TechNova - Initial License",     value: 260000, stage: "CLOSED_WON",    stageId: stages["Closed Won"],    probability: 100, accountId: acctTechNova.id,     ownerId: camila.id, ownerName: "Camila Oliveira", expectedCloseDate: d(12), createdAt: d(75), primaryContactId: ctJohn.id }),
    // CLOSED_LOST (1) — value: 95K
  ]);
  // Separate create for CLOSED_LOST to avoid variable collision
  await mkOpp({ title: "DataFlow - Starter Package", value: 95000, stage: "CLOSED_LOST", stageId: stages["Closed Lost"], probability: 0, accountId: acctDataFlow.id, ownerId: lucas.id, ownerName: "Lucas Costa", expectedCloseDate: d(8), createdAt: d(40) });

  // ─── Tasks (8) — mix of statuses ────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      // PENDING (3)
      { organizationId: O, title: "Send proposal to CloudFirst",       type: "EMAIL",     priority: "HIGH",     status: "PENDING",     ownerId: camila.id,  opportunityId: opps[2].id, dueDate: future(2) },
      { organizationId: O, title: "Schedule demo with AI Labs",         type: "MEETING",   priority: "MEDIUM",   status: "PENDING",     ownerId: lucas.id,   leadId: leads[7].id,       dueDate: future(3) },
      { organizationId: O, title: "Prepare case study for TechNova",    type: "OTHER",     priority: "MEDIUM",   status: "PENDING",     ownerId: lucas.id,   opportunityId: opps[5].id, dueDate: future(5) },
      // OVERDUE (2)
      { organizationId: O, title: "Follow up with SecureNet",           type: "FOLLOW_UP", priority: "HIGH",     status: "PENDING",     ownerId: camila.id,  leadId: leads[6].id,       dueDate: d(2) },
      { organizationId: O, title: "Call DataFlow for qualification",    type: "CALL",      priority: "HIGH",     status: "PENDING",     ownerId: rafael.id,  leadId: leads[4].id,       dueDate: d(1) },
      // COMPLETED (2)
      { organizationId: O, title: "Send NDA to GlobalRetail",           type: "EMAIL",     priority: "MEDIUM",   status: "COMPLETED",   ownerId: lucas.id,   opportunityId: opps[6].id, dueDate: d(7) },
      { organizationId: O, title: "Qualification call with Sarah",      type: "CALL",      priority: "HIGH",     status: "COMPLETED",   ownerId: joao.id,    leadId: leads[3].id,       dueDate: d(5) },
      // IN_PROGRESS (1)
      { organizationId: O, title: "Finalize pricing for CloudFirst API", type: "OTHER",    priority: "CRITICAL", status: "IN_PROGRESS", ownerId: camila.id,  opportunityId: opps[9].id, dueDate: future(1) },
    ],
  });

  // ─── Meetings (4) — 2 past, 2 future ───────────────────────────────────────
  await prisma.meeting.createMany({
    data: [
      { organizationId: O, title: "TechNova Discovery Call",    ownerId: lucas.id,  contactId: ctJohn.id,  leadId: leads[0].id, startTime: d(5, 14),      endTime: d(5, 15),        location: "Virtual - Zoom",  notes: "Discussed pain points. Strong interest in automation module.", attendees: JSON.stringify(["John Smith", "Paulo Henrique"]) },
      { organizationId: O, title: "CloudFirst Proposal Review", ownerId: camila.id, contactId: ctSarah.id,                      startTime: d(2, 10),      endTime: d(2, 11),        location: "Virtual - Teams", notes: "Reviewed pricing. Requested 15% volume discount.",            attendees: JSON.stringify(["Sarah Chen", "Mariana Souza"]) },
      { organizationId: O, title: "SecureNet Technical Demo",   ownerId: camila.id, contactId: ctEmma.id,  leadId: leads[6].id, startTime: future(2, 14), endTime: future(2, 15),   location: "Virtual - Zoom",                                                                                attendees: JSON.stringify(["Emma Rodriguez", "Security Team"]) },
      { organizationId: O, title: "AI Labs CEO Alignment",      ownerId: lucas.id,  contactId: ctDavid.id, leadId: leads[7].id, startTime: future(5, 10), endTime: future(5, 11),   location: "Virtual - Teams",                                                                               attendees: JSON.stringify(["David Kim"]) },
    ],
  });

  // ─── Activities (24) — spread across 30 days ───────────────────────────────
  await prisma.activity.createMany({
    data: [
      // Week 1 (recent)
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Follow-up on proposal",       body: "Sent revised proposal with updated pricing for TechNova",                    creatorId: lucas.id,  leadId: leads[0].id,  opportunityId: opps[5].id, createdAt: d(1, 9) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Qualification call",          body: "30-min discovery call with Sarah. Discussed cloud migration needs.",         creatorId: camila.id, leadId: leads[3].id,                              createdAt: d(1, 14) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Champion confirmed",          body: "Sarah confirmed budget approval for Q2. Moving to proposal.",                creatorId: joao.id,   leadId: leads[3].id,                              createdAt: d(2, 10) },
      { organizationId: O, type: "WHATSAPP",     channel: "whatsapp", subject: "Quick check-in",              body: "Quick check-in with David about timeline for ML Suite evaluation.",          creatorId: rafael.id, leadId: leads[7].id,                              createdAt: d(2, 16) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: DISCOVERY -> QUALIFICATION", body: "CloudFirst Growth Plan moved to Qualification.",                      creatorId: camila.id, opportunityId: opps[2].id,                        createdAt: d(3, 11) },
      // Week 2
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "ROI analysis shared",         body: "Sent ROI analysis showing 3.2x return in first year for Global Retail.",    creatorId: lucas.id,  opportunityId: opps[6].id,                        createdAt: d(5, 9) },
      { organizationId: O, type: "MEETING",      channel: "video",    subject: "Demo session with SecureNet", body: "Product demo with 4 stakeholders. Strong interest in compliance module.",    creatorId: camila.id, leadId: leads[6].id,                              createdAt: d(5, 14) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Objection handling",          body: "Addressed pricing concerns. Competitor offering 20% less but no compliance.", creatorId: lucas.id,  opportunityId: opps[5].id,                       createdAt: d(6, 10) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Risk flag - DataFlow",        body: "DataFlow deal at risk: budget freeze announced. Monitoring closely.",         creatorId: patricia.id,                                                  createdAt: d(7, 15) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Contract draft sent",         body: "Legal team reviewing contract for TechNova Support Upgrade.",                creatorId: lucas.id,  opportunityId: opps[8].id,                        createdAt: d(7, 9) },
      // Week 3
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Cold outreach - FinanceHub",  body: "First call with CFO. Interested in revenue analytics. Booked follow-up.",   creatorId: joao.id,   leadId: leads[1].id,                              createdAt: d(10, 11) },
      { organizationId: O, type: "WHATSAPP",     channel: "whatsapp", subject: "Quick update from Lisa",      body: "Lisa confirmed Phase 1 go-live was successful. Discussing Phase 2.",        creatorId: lucas.id,  leadId: leads[9].id,  opportunityId: opps[10].id, createdAt: d(10, 16) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Proposal sent to SecureNet",  body: "Full platform proposal at R$200K. 60-day implementation.",                  creatorId: camila.id, leadId: leads[6].id,  opportunityId: opps[0].id,  createdAt: d(12, 9) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: PROPOSAL -> NEGOTIATION", body: "CloudFirst API Gateway advanced to Negotiation.",                       creatorId: camila.id, opportunityId: opps[9].id,                        createdAt: d(14, 10) },
      // Week 4
      { organizationId: O, type: "MEETING",      channel: "video",    subject: "Executive alignment",         body: "Quarterly pipeline review with leadership team.",                            creatorId: patricia.id,                                                  createdAt: d(15, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Follow-up with Emma",         body: "Emma says internal approval expected next week for compliance module.",      creatorId: camila.id, leadId: leads[6].id,                              createdAt: d(17, 14) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Welcome email - Global Retail", body: "Sent onboarding welcome package after Phase 1 closed.",                   creatorId: lucas.id,  opportunityId: opps[10].id,                       createdAt: d(20, 9) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Forecast update",             body: "Updated Q2 forecast: commit at R$1.1M, best case R$1.8M.",                 creatorId: ana.id,                                                       createdAt: d(21, 16) },
      // Older
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Initial outreach - LogiPrime", body: "Left voicemail. Will retry in 2 days.",                                   creatorId: rafael.id, leadId: leads[2].id,                              createdAt: d(22, 11) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: NEGOTIATION -> CLOSED_WON", body: "Global Retail Phase 1 closed for R$320K.",                           creatorId: lucas.id,  opportunityId: opps[10].id,                       createdAt: d(5, 17) },
      { organizationId: O, type: "STAGE_CHANGE", channel: "system",   subject: "Stage: PROPOSAL -> CLOSED_WON",    body: "TechNova Initial License closed for R$260K.",                        creatorId: camila.id, opportunityId: opps[11].id,                       createdAt: d(12, 17) },
      { organizationId: O, type: "EMAIL",        channel: "email",    subject: "Lost deal post-mortem",       body: "DataFlow Starter lost to competitor. Price was the deciding factor.",        creatorId: lucas.id,                                                     createdAt: d(8, 10) },
      { organizationId: O, type: "CALL",         channel: "phone",    subject: "Referral from John",          body: "John Smith referred Emma Rodriguez at SecureNet. Hot lead.",                 creatorId: rafael.id, leadId: leads[6].id,                              createdAt: d(25, 14) },
      { organizationId: O, type: "NOTE",         channel: "internal", subject: "Team standup notes",          body: "Rafael: 3 new leads qualified. Joao: 2 demos booked. Pipeline healthy.",    creatorId: patricia.id,                                                  createdAt: d(3, 9) },
    ],
  });

  // ─── Inbox Messages (12) ────────────────────────────────────────────────────
  await prisma.inboxMessage.createMany({
    data: [
      { organizationId: O, channel: "EMAIL",    sender: "john.smith@technova.io",    subject: "Re: Implementation Timeline",  body: "Thanks for the proposal. We reviewed it with our CTO and have a few questions about the implementation timeline. Can we schedule a call this week?", isRead: false, createdAt:d(0, 19) },
      { organizationId: O, channel: "WHATSAPP", sender: "michael@dataflow.io",       subject: "Quick question",               body: "Can you clarify the pricing for the analytics module? Our budget is approved for Q2.",                                                               isRead: false, createdAt:d(0, 19) },
      { organizationId: O, channel: "EMAIL",    sender: "sarah.chen@cloudfirst.com", subject: "API Gateway Proposal Feedback", body: "We'd like to move forward but need a 10% discount for annual commitment. Can we discuss?",                                                          isRead: false, createdAt:d(0, 7) },
      { organizationId: O, channel: "EMAIL",    sender: "emma@securenet.io",         subject: "Compliance Requirements",      body: "Attached our compliance requirements checklist. Can your platform meet all 23 criteria?",                                                             isRead: true,  createdAt:d(1, 10) },
      { organizationId: O, channel: "CALL",     sender: "rodrigo@financehub.com",    subject: "Missed Call",                  body: "Called to discuss revenue analytics demo. Please call back.",                                                                                          isRead: false, createdAt:d(1, 16) },
      { organizationId: O, channel: "EMAIL",    sender: "lisa@globalretail.com",     subject: "Phase 2 Discussion",           body: "Phase 1 is going great! We want to discuss expanding to Phase 2 with additional modules.",                                                            isRead: true,  createdAt:d(2, 9) },
      { organizationId: O, channel: "WHATSAPP", sender: "david@aiinnov.io",          subject: "ML Suite Timeline",            body: "When can we start the POC for the ML Suite? Our data science team is ready.",                                                                          isRead: false, createdAt:d(2, 15) },
      { organizationId: O, channel: "EMAIL",    sender: "ads@google.com",            subject: "Your campaign performance",    body: "Your Google Ads campaign generated 47 clicks this week.",                                                                                              isRead: true,  createdAt:d(3, 8) },
      { organizationId: O, channel: "EMAIL",    sender: "newsletter@saas.weekly",    subject: "Top SaaS trends Q2 2026",      body: "This week's roundup of the hottest SaaS trends and funding news.",                                                                                     isRead: true,  createdAt:d(4, 7) },
      { organizationId: O, channel: "INTERNAL", sender: "system",                    subject: "Weekly Pipeline Summary",      body: "Your pipeline grew 12% this week. 2 new qualified leads, 1 deal advanced to negotiation.",                                                             isRead: false, createdAt:d(0, 8) },
      { organizationId: O, channel: "EMAIL",    sender: "fernanda@logiprime.com",    subject: "Web Agency Submission",        body: "We submitted our requirements via your website. Looking forward to hearing from you.",                                                                  isRead: false, createdAt:d(0, 7) },
      { organizationId: O, channel: "EMAIL",    sender: "paulo@technova.io",         subject: "Product Feedback",             body: "Our product team loved the demo. Can we get access to the sandbox environment?",                                                                       isRead: false, createdAt:d(1, 11) },
    ],
  });

  // ─── Integrations (12) ──────────────────────────────────────────────────────
  const integrationNames = ["Gmail", "Outlook", "WhatsApp", "Slack", "HubSpot", "Salesforce", "Zapier", "Stripe", "Calendly", "Zoom", "Microsoft Teams", "Jira"];
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

  // ─── Playbooks (2) ─────────────────────────────────────────────────────────
  await prisma.playbook.createMany({
    data: [
      { organizationId: O, name: "Enterprise Sales Playbook", description: "Step-by-step guide for enterprise deals >R$200K", segment: "Enterprise", stage: "Discovery", conversionRate: 65, usage: 234 },
      { organizationId: O, name: "SMB Quick Start",           description: "Fast-track for SMB customers <R$100K",           segment: "SMB",        stage: "Demo",      conversionRate: 45, usage: 156 },
    ],
  });

  // ─── Insights (4) ──────────────────────────────────────────────────────────
  await prisma.insight.createMany({
    data: [
      { organizationId: O, category: "pipeline",    title: "High-value deals need attention",      description: "3 deals over R$300K have no activity in the last 5 days.", impact: "HIGH",   confidence: 92, suggestedAction: "Schedule check-in calls with account owners.",  },
      { organizationId: O, category: "engagement",  title: "Response time improving",              description: "Average response time decreased by 18% this month.",       impact: "MEDIUM", confidence: 87, suggestedAction: "Maintain current cadence. Share best practices with team.",  },
      { organizationId: O, category: "risk",         title: "DataFlow deal at risk",                description: "Budget freeze reported at DataFlow. Monitor closely.",      impact: "HIGH",   confidence: 95, suggestedAction: "Engage champion and propose phased approach.",  },
      { organizationId: O, category: "performance", title: "Top performer: Lucas Costa",           description: "Lucas closed R$580K this quarter with 67% win rate.",       impact: "LOW",    confidence: 98, suggestedAction: "Schedule knowledge-sharing session for team.",  },
    ],
  });

  // ─── Forecast Snapshots ─────────────────────────────────────────────────────
  await prisma.forecastSnapshot.createMany({
    data: [
      { organizationId: O, quarter: "Q1", year: 2026, commit: 580000,  bestCase: 850000,  pipeline: 2530000, target: 900000 },
      { organizationId: O, quarter: "Q2", year: 2026, commit: 400000,  bestCase: 680000,  pipeline: 1800000, target: 1000000 },
    ],
  });

  // ─── Audit Logs (5) ────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { organizationId: O, userId: lucas.id,   action: "opportunity.closed_won",      objectType: "Opportunity", objectId: opps[10].id, details: "Global Retail Phase 1 closed for R$320K",  source: "web", createdAt: d(5) },
      { organizationId: O, userId: camila.id,  action: "opportunity.closed_won",      objectType: "Opportunity", objectId: opps[11].id, details: "TechNova Initial License closed for R$260K", source: "web", createdAt: d(12) },
      { organizationId: O, userId: rafael.id,  action: "lead.status_changed",         objectType: "Lead",        objectId: leads[6].id, details: "Status changed from CONTACTED to QUALIFIED",  source: "web", createdAt: d(15) },
      { organizationId: O, userId: joao.id,    action: "lead.status_changed",         objectType: "Lead",        objectId: leads[7].id, details: "Status changed from NEW to QUALIFIED",        source: "web", createdAt: d(18) },
      { organizationId: O, userId: ana.id,     action: "settings.modules_updated",    objectType: "Organization", objectId: org.id,     details: "Enabled modules: commercial, data, reports, playbooks", source: "admin", createdAt: d(30) },
    ],
  });

  // ─── Webhook Events ────────────────────────────────────────────────────────
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

  console.log("Seed completed successfully!");
  console.log(`
  Summary:
  - 1 Organization
  - 3 Teams, 7 Users (ADMIN, 2 SDRs, 2 Closers, MANAGER, DIRECTOR)
  - 8 Companies, 10 Contacts
  - 12 Leads (NEW:3, CONTACTED:3, QUALIFIED:3, CONVERTED:2, DISQUALIFIED:1)
  - 6 Accounts (2 customers)
  - 13 Opportunities (DISCOVERY:2, QUALIFICATION:3, PROPOSAL:3, NEGOTIATION:2, WON:2, LOST:1)
  - 8 Tasks (PENDING:3, OVERDUE:2, COMPLETED:2, IN_PROGRESS:1)
  - 4 Meetings (2 past, 2 future)
  - 24 Activities (spread across 25 days)
  - 12 Inbox Messages
  - 12 Integrations, 2 Playbooks, 4 Insights, 2 Forecast Snapshots

  Expected Metrics:
  - Active Pipeline: R$2,530,000
  - Won Revenue: R$580,000
  - Win Rate: 67% (2 won / 3 closed)
  - Avg Deal Size: R$281,111
  - Forecast Commit (>=70%): R$730,000
  - At Risk (prob<40): 3 deals
  - Overdue Tasks: 2
  - Conversion Rate: 17% (2/12)
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
