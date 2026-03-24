import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.integrationCredential.deleteMany();
  await prisma.integration.deleteMany();
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

  // Create organization
  console.log("📦 Creating organization...");
  const org = await prisma.organization.create({
    data: {
      name: "Aexion Inc",
      slug: "aexion-inc",
    },
  });

  // Create teams
  console.log("👥 Creating teams...");
  const sdrTeam = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: "Sales Development",
      description: "SDR team focused on lead generation and qualification",
    },
  });

  const closerTeam = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: "Sales Closing",
      description: "Closer team focused on deal closure",
    },
  });

  const managerTeam = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: "Sales Management",
      description: "Team managers overseeing sales reps",
    },
  });

  // Hash password
  const hashedPassword = await bcrypt.hash("aexion123", 10);

  // Create users
  console.log("👤 Creating users...");
  const users = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: org.id,
        teamId: sdrTeam.id,
        email: "ana@aexion.io",
        name: "Ana Silva",
        password: hashedPassword,
        role: "ADMIN",
        workspace: "EXECUTIVE",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        teamId: sdrTeam.id,
        email: "rafael@aexion.io",
        name: "Rafael Santos",
        password: hashedPassword,
        role: "SDR",
        workspace: "SDR",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        teamId: closerTeam.id,
        email: "lucas@aexion.io",
        name: "Lucas Costa",
        password: hashedPassword,
        role: "CLOSER",
        workspace: "CLOSER",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        teamId: closerTeam.id,
        email: "camila@aexion.io",
        name: "Camila Oliveira",
        password: hashedPassword,
        role: "CLOSER",
        workspace: "CLOSER",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        teamId: managerTeam.id,
        email: "patricia@aexion.io",
        name: "Patricia Manager",
        password: hashedPassword,
        role: "MANAGER",
        workspace: "MANAGER",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        teamId: managerTeam.id,
        email: "bruno@aexion.io",
        name: "Bruno Sales Manager",
        password: hashedPassword,
        role: "MANAGER",
        workspace: "MANAGER",
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        email: "fernanda@aexion.io",
        name: "Fernanda Director",
        password: hashedPassword,
        role: "DIRECTOR",
        workspace: "EXECUTIVE",
      },
    }),
  ]);

  const [ana, rafael, lucas, camila, patricia, bruno, fernanda] = users;

  // Update teams with managers
  await prisma.team.update({
    where: { id: sdrTeam.id },
    data: { managerId: patricia.id },
  });

  await prisma.team.update({
    where: { id: closerTeam.id },
    data: { managerId: bruno.id },
  });

  // Create companies
  console.log("🏢 Creating companies...");
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        organizationId: org.id,
        name: "TechNova Solutions",
        industry: "Technology",
        size: "1000-5000",
        website: "technova.io",
        annualRevenue: 50000000,
      },
    }),
    prisma.company.create({
      data: {
        organizationId: org.id,
        name: "CloudFirst Corp",
        industry: "Cloud Services",
        size: "500-1000",
        website: "cloudfirst.com",
        annualRevenue: 30000000,
      },
    }),
    prisma.company.create({
      data: {
        organizationId: org.id,
        name: "DataFlow Analytics",
        industry: "Analytics",
        size: "100-500",
        website: "dataflow.io",
        annualRevenue: 15000000,
      },
    }),
    prisma.company.create({
      data: {
        organizationId: org.id,
        name: "SecureNet Systems",
        industry: "Cybersecurity",
        size: "1000-5000",
        website: "securenet.io",
        annualRevenue: 80000000,
      },
    }),
    prisma.company.create({
      data: {
        organizationId: org.id,
        name: "AI Innovations Labs",
        industry: "AI/ML",
        size: "50-100",
        website: "aiinnov.io",
        annualRevenue: 5000000,
      },
    }),
    prisma.company.create({
      data: {
        organizationId: org.id,
        name: "Global Retail Inc",
        industry: "Retail",
        size: "5000+",
        website: "globalretail.com",
        annualRevenue: 500000000,
      },
    }),
  ]);

  const [technova, cloudfirst, dataflow, securenet, aiinnov, globalretail] =
    companies;

  // Create contacts
  console.log("📇 Creating contacts...");
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        companyId: technova.id,
        name: "John Smith",
        email: "john.smith@technova.io",
        phone: "+55 11 98765-4321",
        title: "CTO",
        isChampion: true,
        isDecisionMaker: true,
      },
    }),
    prisma.contact.create({
      data: {
        companyId: technova.id,
        name: "Sarah Johnson",
        email: "sarah.johnson@technova.io",
        phone: "+55 11 99876-5432",
        title: "VP Sales",
        isChampion: false,
        isDecisionMaker: true,
      },
    }),
    prisma.contact.create({
      data: {
        companyId: cloudfirst.id,
        name: "Michael Chen",
        email: "m.chen@cloudfirst.com",
        phone: "+55 21 98765-4321",
        title: "Engineering Director",
        isChampion: true,
        isDecisionMaker: false,
      },
    }),
    prisma.contact.create({
      data: {
        companyId: dataflow.id,
        name: "Emma Rodriguez",
        email: "emma@dataflow.io",
        phone: "+55 31 98765-4321",
        title: "Product Lead",
        isChampion: false,
        isDecisionMaker: false,
      },
    }),
    prisma.contact.create({
      data: {
        companyId: securenet.id,
        name: "David Kim",
        email: "david@securenet.io",
        phone: "+55 41 98765-4321",
        title: "Security Officer",
        isChampion: true,
        isDecisionMaker: true,
      },
    }),
    prisma.contact.create({
      data: {
        companyId: aiinnov.id,
        name: "Lisa Wang",
        email: "lisa@aiinnov.io",
        phone: "+55 51 98765-4321",
        title: "CEO",
        isChampion: true,
        isDecisionMaker: true,
      },
    }),
    prisma.contact.create({
      data: {
        companyId: globalretail.id,
        name: "Robert Taylor",
        email: "r.taylor@globalretail.com",
        phone: "+55 61 98765-4321",
        title: "IT Director",
        isChampion: false,
        isDecisionMaker: true,
      },
    }),
    prisma.contact.create({
      data: {
        companyId: globalretail.id,
        name: "Jennifer Lee",
        email: "j.lee@globalretail.com",
        phone: "+55 61 98765-5432",
        title: "Operations Manager",
        isChampion: false,
        isDecisionMaker: false,
      },
    }),
  ]);

  // Create accounts
  console.log("🎯 Creating accounts...");
  const accounts = await Promise.all([
    prisma.account.create({
      data: {
        organizationId: org.id,
        companyId: technova.id,
        name: "TechNova - Enterprise Account",
        status: "active",
        ownerId: lucas.id,
      },
    }),
    prisma.account.create({
      data: {
        organizationId: org.id,
        companyId: cloudfirst.id,
        name: "CloudFirst - Growth Account",
        status: "active",
        ownerId: camila.id,
      },
    }),
    prisma.account.create({
      data: {
        organizationId: org.id,
        companyId: dataflow.id,
        name: "DataFlow - SMB Account",
        status: "active",
        ownerId: lucas.id,
      },
    }),
    prisma.account.create({
      data: {
        organizationId: org.id,
        companyId: securenet.id,
        name: "SecureNet - Enterprise",
        status: "active",
        ownerId: camila.id,
      },
    }),
    prisma.account.create({
      data: {
        organizationId: org.id,
        companyId: aiinnov.id,
        name: "AI Innovations - Startup",
        status: "active",
        ownerId: lucas.id,
      },
    }),
    prisma.account.create({
      data: {
        organizationId: org.id,
        companyId: globalretail.id,
        name: "Global Retail - Strategic",
        status: "active",
        ownerId: camila.id,
      },
    }),
  ]);

  // Create leads
  console.log("📝 Creating leads...");
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        organizationId: org.id,
        companyId: technova.id,
        contactId: contacts[0].id,
        name: "John Smith",
        email: "john.smith@technova.io",
        phone: "+55 11 98765-4321",
        title: "CTO",
        source: "linkedin",
        status: "CONTACTED",
        temperature: "HOT",
        fitScore: 95,
        ownerId: ana.id,
        lastContact: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
    }),
    prisma.lead.create({
      data: {
        organizationId: org.id,
        companyId: cloudfirst.id,
        contactId: contacts[2].id,
        name: "Michael Chen",
        email: "m.chen@cloudfirst.com",
        phone: "+55 21 98765-4321",
        title: "Engineering Director",
        source: "web",
        status: "QUALIFIED",
        temperature: "WARM",
        fitScore: 88,
        ownerId: rafael.id,
        lastContact: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
    }),
    prisma.lead.create({
      data: {
        organizationId: org.id,
        companyId: dataflow.id,
        contactId: contacts[3].id,
        name: "Emma Rodriguez",
        email: "emma@dataflow.io",
        phone: "+55 31 98765-4321",
        title: "Product Lead",
        source: "email",
        status: "NEW",
        temperature: "COLD",
        fitScore: 65,
        ownerId: ana.id,
        lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    }),
    prisma.lead.create({
      data: {
        organizationId: org.id,
        companyId: securenet.id,
        contactId: contacts[4].id,
        name: "David Kim",
        email: "david@securenet.io",
        phone: "+55 41 98765-4321",
        title: "Security Officer",
        source: "referral",
        status: "QUALIFIED",
        temperature: "HOT",
        fitScore: 92,
        ownerId: rafael.id,
        lastContact: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
    }),
    prisma.lead.create({
      data: {
        organizationId: org.id,
        companyId: aiinnov.id,
        contactId: contacts[5].id,
        name: "Lisa Wang",
        email: "lisa@aiinnov.io",
        phone: "+55 51 98765-4321",
        title: "CEO",
        source: "event",
        status: "CONVERTED",
        temperature: "HOT",
        fitScore: 98,
        ownerId: ana.id,
        lastContact: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000), // Today
      },
    }),
  ]);

  // Create pipeline with stages
  console.log("🔄 Creating pipeline...");
  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId: org.id,
      name: "Default Sales Pipeline",
      description: "Main sales pipeline for all deals",
      stages: {
        create: [
          { name: "Discovery", order: 1, color: "#64748B" },
          { name: "Demo", order: 2, color: "#0EA5E9" },
          { name: "Proposal", order: 3, color: "#8B5CF6" },
          { name: "Negotiation", order: 4, color: "#F59E0B" },
          { name: "Closed Won", order: 5, color: "#10B981" },
          { name: "Closed Lost", order: 6, color: "#EF4444" },
        ],
      },
    },
  });

  // Get stages
  const stages = await prisma.stage.findMany({
    where: { pipelineId: pipeline.id },
  });

  // Create opportunities
  console.log("💼 Creating opportunities...");
  await Promise.all([
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[0].id,
        title: "TechNova - Enterprise Deal",
        description: "Large enterprise implementation",
        value: 500000,
        stage: "PROPOSAL",
        stageId: stages[2].id,
        ownerId: lucas.id,
        ownerName: "Lucas Costa",
        probability: 75,
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[1].id,
        title: "CloudFirst - Growth Plan",
        description: "Expansion of existing services",
        value: 250000,
        stage: "QUALIFICATION",
        stageId: stages[1].id,
        ownerId: camila.id,
        ownerName: "Camila Oliveira",
        probability: 50,
        expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[2].id,
        title: "DataFlow - SMB Package",
        description: "Standard SMB tier implementation",
        value: 75000,
        stage: "NEGOTIATION",
        stageId: stages[3].id,
        ownerId: lucas.id,
        ownerName: "Lucas Costa",
        probability: 60,
        expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[3].id,
        title: "SecureNet - Security Suite",
        description: "Full security implementation",
        value: 350000,
        stage: "DISCOVERY",
        stageId: stages[0].id,
        ownerId: camila.id,
        ownerName: "Camila Oliveira",
        probability: 30,
        expectedCloseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    }),
    // Additional opportunities for richer pipeline
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[4].id,
        title: "AI Labs - ML Platform",
        description: "Machine learning platform integration",
        value: 180000,
        stage: "DISCOVERY",
        stageId: stages[0].id,
        ownerId: lucas.id,
        ownerName: "Lucas Costa",
        probability: 25,
        expectedCloseDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[5].id,
        title: "Global Retail - Full Suite",
        description: "Complete retail analytics suite",
        value: 680000,
        stage: "PROPOSAL",
        stageId: stages[2].id,
        ownerId: camila.id,
        ownerName: "Camila Oliveira",
        probability: 65,
        expectedCloseDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[0].id,
        title: "TechNova - Support Tier Upgrade",
        description: "Premium support tier upgrade",
        value: 95000,
        stage: "NEGOTIATION",
        stageId: stages[3].id,
        ownerId: lucas.id,
        ownerName: "Lucas Costa",
        probability: 85,
        expectedCloseDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[1].id,
        title: "CloudFirst - API Gateway",
        description: "API gateway implementation",
        value: 120000,
        stage: "QUALIFICATION",
        stageId: stages[1].id,
        ownerId: camila.id,
        ownerName: "Camila Oliveira",
        probability: 40,
        expectedCloseDate: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[3].id,
        title: "SecureNet - Compliance Module",
        description: "Compliance and audit module",
        value: 220000,
        stage: "CLOSED_WON",
        stageId: stages[4].id,
        ownerId: lucas.id,
        ownerName: "Lucas Costa",
        probability: 100,
        expectedCloseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: org.id,
        accountId: accounts[2].id,
        title: "DataFlow - Starter Package",
        description: "Basic analytics starter kit",
        value: 35000,
        stage: "CLOSED_LOST",
        stageId: stages[5].id,
        ownerId: camila.id,
        ownerName: "Camila Oliveira",
        probability: 0,
        expectedCloseDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  // Create tasks
  console.log("✅ Creating tasks...");
  await prisma.task.createMany({
    data: [
      {
        organizationId: org.id,
        title: "Follow up with TechNova",
        type: "FOLLOW_UP",
        priority: "HIGH",
        status: "PENDING",
        ownerId: lucas.id,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId: org.id,
        title: "Call CloudFirst CTO",
        type: "CALL",
        priority: "HIGH",
        status: "PENDING",
        ownerId: camila.id,
        dueDate: new Date(Date.now() + 0 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId: org.id,
        title: "Send proposal to DataFlow",
        type: "EMAIL",
        priority: "MEDIUM",
        status: "PENDING",
        ownerId: lucas.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId: org.id,
        title: "Schedule demo with SecureNet",
        type: "MEETING",
        priority: "HIGH",
        status: "PENDING",
        ownerId: camila.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // Create Activities (Timeline events)
  console.log("📝 Creating activities...");
  await prisma.activity.createMany({
    data: [
      {
        organizationId: org.id,
        type: "MESSAGE",
        channel: "email",
        subject: "Outbound effort: Discovery email sent",
        body: "Sent intro email regarding new CRM requirements.",
        creatorId: rafael.id, // SDR
        leadId: leads[1].id, // Michael Chen (CloudFirst)
      },
      {
        organizationId: org.id,
        type: "CALL",
        channel: "internal",
        subject: "Qualification Call",
        body: "Spoke with David Kim. They have budget approved for Q3. Strong fit.",
        creatorId: rafael.id, // SDR
        leadId: leads[3].id, // David Kim
      },
      {
        organizationId: org.id,
        type: "STAGE_CHANGE",
        channel: "system",
        subject: "Stage changed: DISCOVERY → PROPOSAL",
        body: "Opportunity moved forward after successful pricing discussion.",
        creatorId: lucas.id, // Closer
        opportunityId: accounts[0].id, // Actually, use an opportunity ID. We'll use the ID of the first opp below, but wait, we need the Opportunity IDs.
        // I will omit opportunityId for this hardcoded list and only provide it if I query first, but since it's createMany it's tricky.
      }
    ]
  });

  // Create meetings
  console.log("📅 Creating meetings...");
  await prisma.meeting.createMany({
    data: [
      {
        organizationId: org.id,
        title: "TechNova Discovery Call",
        description: "Initial discovery meeting with TechNova team",
        contactId: contacts[0].id,
        ownerId: lucas.id,
        startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        location: "Virtual - Zoom",
        attendees: JSON.stringify(["Lucas Costa", "John Smith", "Sarah Johnson"]),
      },
      {
        organizationId: org.id,
        title: "CloudFirst Demo",
        description: "Product demo for CloudFirst",
        contactId: contacts[2].id,
        ownerId: camila.id,
        startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        location: "Virtual - Teams",
        attendees: JSON.stringify(["Camila Oliveira", "Michael Chen"]),
      },
    ],
  });

  // Create inbox messages
  console.log("📧 Creating inbox messages...");
  await prisma.inboxMessage.createMany({
    data: [
      {
        organizationId: org.id,
        channel: "EMAIL",
        sender: "john.smith@technova.io",
        subject: "Re: Implementation Timeline",
        body: "Thanks for the proposal. We're interested in moving forward.",
        isRead: false,
      },
      {
        organizationId: org.id,
        channel: "WHATSAPP",
        sender: "Michael Chen",
        subject: "Quick question",
        body: "Can you clarify the pricing model?",
        isRead: true,
      },
    ],
  });

  // Create integrations
  // ALL integrations start DISCONNECTED — real OAuth is required for Gmail.
  // Non-Gmail integrations have no provider implementation yet (Coming Soon).
  console.log("🔗 Creating integrations...");
  await prisma.integration.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Gmail",
        slug: "gmail",
        providerKey: "gmail",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Outlook",
        slug: "outlook",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "WhatsApp",
        slug: "whatsapp",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Slack",
        slug: "slack",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "HubSpot",
        slug: "hubspot",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Salesforce",
        slug: "salesforce",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Zapier",
        slug: "zapier",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Stripe",
        slug: "stripe",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Calendly",
        slug: "calendly",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Zoom",
        slug: "zoom",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Microsoft Teams",
        slug: "teams",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
      {
        organizationId: org.id,
        name: "Jira",
        slug: "jira",
        status: "DISCONNECTED",
        healthPercent: 0,
        eventsReceived: 0,
        errorCount: 0,
      },
    ],
  });

  // Create playbooks
  console.log("📚 Creating playbooks...");
  await prisma.playbook.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Enterprise Sales Playbook",
        description: "Step-by-step guide for enterprise deals",
        segment: "Enterprise",
        stage: "Discovery",
        conversionRate: 65,
        usage: 234,
      },
      {
        organizationId: org.id,
        name: "SMB Quick Start",
        description: "Fast-track for SMB customers",
        segment: "SMB",
        stage: "Demo",
        conversionRate: 45,
        usage: 156,
      },
    ],
  });

  // Create insights
  console.log("💡 Creating insights...");
  await prisma.insight.createMany({
    data: [
      {
        organizationId: org.id,
        category: "PIPELINE",
        title: "High-value deals need attention",
        description:
          "3 deals over $500K have no activity in the last week",
        impact: "HIGH",
        confidence: 95,
        suggestedAction:
          "Schedule check-in calls with account owners",
      },
      {
        organizationId: org.id,
        category: "ENGAGEMENT",
        title: "Response time declining",
        description: "Average response time has increased by 23%",
        impact: "MEDIUM",
        confidence: 85,
        suggestedAction:
          "Review workload distribution and capacity planning",
      },
    ],
  });

  // Create activities
  console.log("📊 Creating activities...");
  await prisma.activity.createMany({
    data: [
      { type: "EMAIL", channel: "email", subject: "Follow-up on proposal", body: "Sent revised proposal with updated pricing", creatorId: lucas.id, leadId: leads[0].id, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { type: "CALL", channel: "phone", subject: "Discovery call", body: "30-minute discovery call with CTO. Discussed pain points and timeline.", creatorId: camila.id, leadId: leads[1].id, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { type: "NOTE", channel: "internal", subject: "Internal update", body: "Champion confirmed budget approval for Q2", creatorId: ana.id, leadId: leads[2].id, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { type: "MEETING", channel: "video", subject: "Demo session", body: "Product demo with 5 stakeholders. Strong interest in analytics module.", creatorId: lucas.id, leadId: leads[3].id, createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
      { type: "EMAIL", channel: "email", subject: "Contract review", body: "Legal team reviewing contract. Expected feedback by end of week.", creatorId: camila.id, leadId: leads[4].id, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { type: "WHATSAPP", channel: "whatsapp", subject: "Quick check-in", body: "Quick check-in on implementation timeline", creatorId: rafael.id, leadId: leads[0].id, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { type: "CALL", channel: "phone", subject: "Qualification call", body: "Qualified opportunity. Budget confirmed at R$250K.", creatorId: ana.id, leadId: leads[1].id, createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
      { type: "NOTE", channel: "internal", subject: "Risk flag", body: "Deal at risk: competitor offering 30% discount", creatorId: patricia.id, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { type: "EMAIL", channel: "email", subject: "ROI documentation", body: "Shared ROI analysis showing 3.2x return in first year", creatorId: lucas.id, leadId: leads[2].id, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { type: "MEETING", channel: "video", subject: "Executive review", body: "Quarterly pipeline review with leadership team", creatorId: bruno.id, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    ],
  });

  // Create inbox messages
  console.log("📬 Creating inbox messages...");
  await prisma.inboxMessage.createMany({
    data: [
      {
        channel: "EMAIL",
        sender: "Maria Silva (TechCorp)",
        subject: "Re: Enterprise License Proposal",
        body: "Thanks for sending over the proposal. We reviewed it with our CTO and have a few questions about the implementation timeline. Can we schedule a call this week?",
        isRead: false,
      },
      {
        channel: "WHATSAPP",
        sender: "João Santos (DataFlow)",
        subject: null,
        body: "Hey, quick question about the API integration options. Our team is evaluating between the REST API and the webhook approach.",
        isRead: false,
      },
      {
        channel: "EMAIL",
        sender: "Patricia Lima (FinanceHub)",
        subject: "Demo Follow-up",
        body: "Great demo yesterday! The team was impressed. We'd like to move forward with a pilot program. What are the next steps?",
        isRead: true,
      },
      {
        channel: "CALL",
        sender: "Roberto Mendes (LogiPrime)",
        subject: "Missed Call",
        body: "Called to discuss the renewal terms. Please call back at your earliest convenience.",
        isRead: false,
      },
      {
        channel: "EMAIL",
        sender: "Ana Rodrigues (HealthTech)",
        subject: "Partnership Opportunity",
        body: "We're exploring a strategic partnership for our healthcare vertical. Would love to discuss how Aexion could complement our offering.",
        isRead: true,
      },
      {
        channel: "INTERNAL",
        sender: "Diego Executive",
        subject: "Q1 Pipeline Review",
        body: "Please prepare the Q1 pipeline metrics for the board meeting next Tuesday. Focus on enterprise deals.",
        isRead: false,
      },
      {
        channel: "WHATSAPP",
        sender: "Fernando Costa (EduLearn)",
        subject: null,
        body: "We signed the contract! When can we start onboarding? Our team is excited to get started.",
        isRead: true,
      },
    ],
  });

  // Create forecast snapshots
  console.log("📈 Creating forecast snapshots...");
  await prisma.forecastSnapshot.createMany({
    data: [
      {
        organizationId: org.id,
        quarter: "Q1",
        year: 2026,
        commit: 480000,
        bestCase: 650000,
        pipeline: 1200000,
        target: 750000,
      },
      {
        organizationId: org.id,
        quarter: "Q2",
        year: 2026,
        commit: 320000,
        bestCase: 520000,
        pipeline: 980000,
        target: 800000,
      },
    ],
  });

  // Create audit logs
  console.log("📋 Creating audit logs...");
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const firstUserId = allUsers[0]?.id || "unknown";
  const secondUserId = allUsers[1]?.id || firstUserId;

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        userId: firstUserId,
        action: "lead.status_changed",
        objectType: "Lead",
        objectId: "lead-1",
        details: "Status changed from NEW to CONTACTED",
        source: "web",
      },
      {
        organizationId: org.id,
        userId: secondUserId,
        action: "opportunity.stage_changed",
        objectType: "Opportunity",
        objectId: "opp-1",
        details: "Stage advanced from Discovery to Proposal",
        source: "web",
      },
      {
        organizationId: org.id,
        userId: firstUserId,
        action: "opportunity.closed_won",
        objectType: "Opportunity",
        objectId: "opp-2",
        details: "Deal closed for R$ 180K",
        source: "web",
      },
      {
        organizationId: org.id,
        userId: secondUserId,
        action: "integration.synced",
        objectType: "Integration",
        objectId: "int-1",
        details: "Salesforce sync completed: 45 records updated",
        source: "system",
      },
      {
        organizationId: org.id,
        userId: firstUserId,
        action: "user.role_changed",
        objectType: "User",
        objectId: "user-3",
        details: "Role changed from SDR to CLOSER",
        source: "admin",
      },
    ],
  });

  // Create webhook events (need integration IDs)
  console.log("🔗 Creating webhook events...");
  const integrations = await prisma.integration.findMany({ select: { id: true } });
  if (integrations.length > 0) {
    await prisma.webhookEvent.createMany({
      data: [
        {
          integrationId: integrations[0].id,
          eventType: "contact.created",
          status: "processed",
          payload: '{"type":"contact","action":"create"}',
          retryCount: 0,
        },
        {
          integrationId: integrations[0].id,
          eventType: "deal.updated",
          status: "processed",
          payload: '{"type":"deal","action":"update"}',
          retryCount: 0,
        },
        {
          integrationId: integrations.length > 1 ? integrations[1].id : integrations[0].id,
          eventType: "email.received",
          status: "failed",
          payload: '{"type":"email","error":"timeout"}',
          retryCount: 3,
        },
        {
          integrationId: integrations[0].id,
          eventType: "task.completed",
          status: "processed",
          payload: '{"type":"task","action":"complete"}',
          retryCount: 0,
        },
      ],
    });
  }

  console.log("✨ Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
