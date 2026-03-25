import { UserRole } from "@/types";
import type {
  Lead,
  Account,
  Opportunity,
  Task,
  Insight,
  Meeting,
  Activity,
  Integration,
  AuditLog,
  Playbook,
  ForecastSnapshot,
  InboxMessage,
  WebhookEvent,
} from "@/types";
import { MOCK_USERS } from "./mock-users";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}
function hoursFromNow(n: number) {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d.toISOString();
}

const getUser = (id: string) => MOCK_USERS.find((u) => u.id === id);

// ─── Companies ───────────────────────────────────────────────────────────────

export const MOCK_COMPANIES = [
  { id: "comp_technova", name: "TechNova Solutions", industry: "Technology", website: "technova.io", size: "201-500", annualRevenue: 25000000, logo: "TN" },
  { id: "comp_dataflow", name: "DataFlow Analytics", industry: "Data & Analytics", website: "dataflow.com", size: "51-200", annualRevenue: 8000000, logo: "DF" },
  { id: "comp_cloudbase", name: "CloudBase Infrastructure", industry: "Cloud Computing", website: "cloudbase.io", size: "501-1000", annualRevenue: 45000000, logo: "CB" },
  { id: "comp_innovatech", name: "InnovateTech Corp", industry: "Software", website: "innovatech.com", size: "1001-5000", annualRevenue: 120000000, logo: "IT" },
  { id: "comp_nexgen", name: "NexGen Retail", industry: "Retail Tech", website: "nexgenretail.com", size: "201-500", annualRevenue: 18000000, logo: "NR" },
  { id: "comp_finpro", name: "FinPro Services", industry: "Financial Services", website: "finpro.com.br", size: "51-200", annualRevenue: 12000000, logo: "FP" },
  { id: "comp_logismart", name: "LogiSmart Logistics", industry: "Logistics", website: "logismart.io", size: "201-500", annualRevenue: 30000000, logo: "LS" },
  { id: "comp_healthplus", name: "HealthPlus Digital", industry: "HealthTech", website: "healthplus.com.br", size: "51-200", annualRevenue: 6000000, logo: "HP" },
  { id: "comp_eduspark", name: "EduSpark Learning", industry: "EdTech", website: "eduspark.io", size: "11-50", annualRevenue: 3000000, logo: "ES" },
  { id: "comp_greenenergy", name: "GreenEnergy Solutions", industry: "Energy", website: "greenenergy.com", size: "501-1000", annualRevenue: 55000000, logo: "GE" },
];

// ─── Contacts ────────────────────────────────────────────────────────────────

export const MOCK_CONTACTS = [
  { id: "cnt_1", name: "Maria Silva", email: "maria@technova.io", phone: "+55 11 99876-5432", title: "CTO", companyId: "comp_technova", isChampion: true, isDecisionMaker: false },
  { id: "cnt_2", name: "João Pereira", email: "joao@dataflow.com", phone: "+55 11 98765-4321", title: "VP Engineering", companyId: "comp_dataflow", isChampion: false, isDecisionMaker: true },
  { id: "cnt_3", name: "Ana Costa", email: "ana.costa@cloudbase.io", phone: "+55 21 99887-6543", title: "Head of Operations", companyId: "comp_cloudbase", isChampion: true, isDecisionMaker: false },
  { id: "cnt_4", name: "Carlos Mendes", email: "carlos@innovatech.com", phone: "+55 11 97654-3210", title: "CEO", companyId: "comp_innovatech", isChampion: false, isDecisionMaker: true },
  { id: "cnt_5", name: "Fernanda Lima", email: "fernanda@nexgenretail.com", phone: "+55 31 98876-5432", title: "Director of Technology", companyId: "comp_nexgen", isChampion: true, isDecisionMaker: true },
  { id: "cnt_6", name: "Roberto Santos", email: "roberto@finpro.com.br", phone: "+55 11 96543-2109", title: "CFO", companyId: "comp_finpro", isChampion: false, isDecisionMaker: true },
  { id: "cnt_7", name: "Juliana Alves", email: "juliana@logismart.io", phone: "+55 41 99765-4321", title: "Product Manager", companyId: "comp_logismart", isChampion: true, isDecisionMaker: false },
  { id: "cnt_8", name: "Pedro Oliveira", email: "pedro@healthplus.com.br", phone: "+55 21 98654-3210", title: "CEO", companyId: "comp_healthplus", isChampion: false, isDecisionMaker: true },
  { id: "cnt_9", name: "Camila Rodrigues", email: "camila@eduspark.io", phone: "+55 11 97543-2109", title: "Head of Growth", companyId: "comp_eduspark", isChampion: true, isDecisionMaker: false },
  { id: "cnt_10", name: "Lucas Ferreira", email: "lucas@greenenergy.com", phone: "+55 51 96432-1098", title: "VP Sales", companyId: "comp_greenenergy", isChampion: false, isDecisionMaker: true },
];

// ─── Leads ───────────────────────────────────────────────────────────────────

export const MOCK_LEADS: Lead[] = [
  { id: "lead_1", name: "Maria Silva", email: "maria@technova.io", phone: "+55 11 99876-5432", company: "TechNova Solutions", title: "CTO", source: "Inbound — Website", status: "QUALIFIED", fitScore: 87, temperature: "HOT", ownerId: "usr_ana", companyId: "comp_technova", pain: "Manual data integration across 5+ tools", objections: ["Timeline concern", "Integration complexity"], lastContactedAt: daysAgo(1), nextFollowUpAt: daysFromNow(0), createdAt: daysAgo(14), updatedAt: daysAgo(1), createdBy: "usr_ana", confidence: 85, provenance: "website_form" },
  { id: "lead_2", name: "João Pereira", email: "joao@dataflow.com", phone: "+55 11 98765-4321", company: "DataFlow Analytics", title: "VP Engineering", source: "Outbound — LinkedIn", status: "CONTACTED", fitScore: 72, temperature: "WARM", ownerId: "usr_ana", companyId: "comp_dataflow", pain: "Slow pipeline velocity, no real-time analytics", objections: ["Budget constraints"], lastContactedAt: daysAgo(3), nextFollowUpAt: daysAgo(1), createdAt: daysAgo(21), updatedAt: daysAgo(3), createdBy: "usr_ana", confidence: 60, provenance: "linkedin_enrichment" },
  { id: "lead_3", name: "Ana Costa", email: "ana.costa@cloudbase.io", phone: "+55 21 99887-6543", company: "CloudBase Infrastructure", title: "Head of Operations", source: "Referral — Partner", status: "NEW", fitScore: 91, temperature: "HOT", ownerId: "usr_rafael", companyId: "comp_cloudbase", pain: "No visibility into sales operations", objections: [], lastContactedAt: "", nextFollowUpAt: daysFromNow(0), createdAt: daysAgo(2), updatedAt: daysAgo(2), createdBy: "system", confidence: 90, provenance: "partner_referral" },
  { id: "lead_4", name: "Carlos Mendes", email: "carlos@innovatech.com", phone: "+55 11 97654-3210", company: "InnovateTech Corp", title: "CEO", source: "Event — SaaS Conference", status: "QUALIFIED", fitScore: 95, temperature: "HOT", ownerId: "usr_rafael", companyId: "comp_innovatech", pain: "Scaling revenue team from 20 to 80", objections: ["Already evaluating Salesforce"], lastContactedAt: daysAgo(0), nextFollowUpAt: daysFromNow(1), createdAt: daysAgo(10), updatedAt: daysAgo(0), createdBy: "usr_rafael", confidence: 88, provenance: "event_scan" },
  { id: "lead_5", name: "Fernanda Lima", email: "fernanda@nexgenretail.com", phone: "+55 31 98876-5432", company: "NexGen Retail", title: "Director of Technology", source: "Inbound — Content", status: "CONTACTED", fitScore: 65, temperature: "WARM", ownerId: "usr_ana", companyId: "comp_nexgen", pain: "Disconnected sales and marketing data", objections: ["Needs board approval"], lastContactedAt: daysAgo(5), nextFollowUpAt: daysAgo(2), createdAt: daysAgo(18), updatedAt: daysAgo(5), createdBy: "usr_ana", confidence: 50, provenance: "content_download" },
  { id: "lead_6", name: "Roberto Santos", email: "roberto@finpro.com.br", phone: "+55 11 96543-2109", company: "FinPro Services", title: "CFO", source: "Outbound — Cold Email", status: "NEW", fitScore: 78, temperature: "COLD", ownerId: "usr_rafael", companyId: "comp_finpro", pain: "Forecast accuracy below 40%", objections: [], lastContactedAt: "", nextFollowUpAt: daysFromNow(1), createdAt: daysAgo(1), updatedAt: daysAgo(1), createdBy: "usr_rafael", confidence: 40, provenance: "enrichment_api" },
  { id: "lead_7", name: "Juliana Alves", email: "juliana@logismart.io", phone: "+55 41 99765-4321", company: "LogiSmart Logistics", title: "Product Manager", source: "Inbound — Demo Request", status: "QUALIFIED", fitScore: 82, temperature: "WARM", ownerId: "usr_ana", companyId: "comp_logismart", pain: "CRM adoption below 30% in field teams", objections: ["Integration with SAP"], lastContactedAt: daysAgo(2), nextFollowUpAt: daysFromNow(0), createdAt: daysAgo(8), updatedAt: daysAgo(2), createdBy: "usr_ana", confidence: 70, provenance: "demo_form" },
  { id: "lead_8", name: "Pedro Oliveira", email: "pedro@healthplus.com.br", phone: "+55 21 98654-3210", company: "HealthPlus Digital", title: "CEO", source: "Outbound — LinkedIn", status: "UNQUALIFIED", fitScore: 35, temperature: "COLD", ownerId: "usr_rafael", companyId: "comp_healthplus", pain: "Unknown", objections: ["Too early stage", "No budget"], lastContactedAt: daysAgo(7), nextFollowUpAt: "", createdAt: daysAgo(30), updatedAt: daysAgo(7), createdBy: "usr_rafael", confidence: 15, provenance: "linkedin_outbound" },
  { id: "lead_9", name: "Camila Rodrigues", email: "camila@eduspark.io", phone: "+55 11 97543-2109", company: "EduSpark Learning", title: "Head of Growth", source: "Inbound — Webinar", status: "CONTACTED", fitScore: 68, temperature: "WARM", ownerId: "usr_ana", companyId: "comp_eduspark", pain: "No structured sales process", objections: [], lastContactedAt: daysAgo(4), nextFollowUpAt: daysAgo(1), createdAt: daysAgo(12), updatedAt: daysAgo(4), createdBy: "usr_ana", confidence: 55, provenance: "webinar_registration" },
  { id: "lead_10", name: "Lucas Ferreira", email: "lucas@greenenergy.com", phone: "+55 51 96432-1098", company: "GreenEnergy Solutions", title: "VP Sales", source: "Referral — Customer", status: "CONVERTED", fitScore: 93, temperature: "HOT", ownerId: "usr_rafael", companyId: "comp_greenenergy", pain: "Revenue leakage through manual processes", objections: ["Procurement process"], lastContactedAt: daysAgo(3), nextFollowUpAt: "", createdAt: daysAgo(25), updatedAt: daysAgo(3), createdBy: "usr_rafael", confidence: 92, provenance: "customer_referral" },
];

// ─── Accounts ────────────────────────────────────────────────────────────────

export const MOCK_ACCOUNTS: Account[] = [
  { id: "acc_1", name: "TechNova Solutions", industry: "Technology", website: "technova.io", size: "201-500", annualRevenue: 25000000, companyId: "comp_technova", ownerId: "usr_lucas", createdAt: daysAgo(60), updatedAt: daysAgo(1) },
  { id: "acc_2", name: "DataFlow Analytics", industry: "Data & Analytics", website: "dataflow.com", size: "51-200", annualRevenue: 8000000, companyId: "comp_dataflow", ownerId: "usr_lucas", createdAt: daysAgo(45), updatedAt: daysAgo(3) },
  { id: "acc_3", name: "CloudBase Infrastructure", industry: "Cloud Computing", website: "cloudbase.io", size: "501-1000", annualRevenue: 45000000, companyId: "comp_cloudbase", ownerId: "usr_camila", createdAt: daysAgo(90), updatedAt: daysAgo(7) },
  { id: "acc_4", name: "InnovateTech Corp", industry: "Software", website: "innovatech.com", size: "1001-5000", annualRevenue: 120000000, companyId: "comp_innovatech", ownerId: "usr_camila", createdAt: daysAgo(30), updatedAt: daysAgo(0) },
  { id: "acc_5", name: "NexGen Retail", industry: "Retail Tech", website: "nexgenretail.com", size: "201-500", annualRevenue: 18000000, companyId: "comp_nexgen", ownerId: "usr_lucas", createdAt: daysAgo(55), updatedAt: daysAgo(5) },
  { id: "acc_6", name: "GreenEnergy Solutions", industry: "Energy", website: "greenenergy.com", size: "501-1000", annualRevenue: 55000000, companyId: "comp_greenenergy", ownerId: "usr_camila", createdAt: daysAgo(25), updatedAt: daysAgo(3) },
];

// ─── Opportunities ───────────────────────────────────────────────────────────

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  { id: "opp_1", title: "Enterprise License — TechNova", accountId: "acc_1", accountName: "TechNova Solutions", value: 450000, stage: "Proposal", probability: 60, ownerId: "usr_lucas", ownerName: "Lucas Martins", healthScore: 72, closeDate: daysFromNow(18), competitors: ["Salesforce"], champion: "Maria Silva", decisionMaker: "CEO — André TechNova", nextStep: "Send revised proposal with custom pricing", risks: ["Champion leaving in 2 months", "Budget freeze Q2"], createdAt: daysAgo(45), updatedAt: daysAgo(2), stageChangedAt: daysAgo(8), daysInStage: 8 },
  { id: "opp_2", title: "Platform Migration — DataFlow", accountId: "acc_2", accountName: "DataFlow Analytics", value: 280000, stage: "Negotiation", probability: 75, ownerId: "usr_lucas", ownerName: "Lucas Martins", healthScore: 45, closeDate: daysFromNow(10), competitors: ["HubSpot"], champion: "João Pereira", decisionMaker: "João Pereira", nextStep: "Address pricing objection in follow-up call", risks: ["Champion went quiet", "Competitor offering 30% discount"], createdAt: daysAgo(60), updatedAt: daysAgo(1), stageChangedAt: daysAgo(14), daysInStage: 14 },
  { id: "opp_3", title: "API Integration — CloudBase", accountId: "acc_3", accountName: "CloudBase Infrastructure", value: 180000, stage: "Discovery", probability: 30, ownerId: "usr_camila", ownerName: "Camila Souza", healthScore: 85, closeDate: daysFromNow(45), competitors: [], champion: "Ana Costa", decisionMaker: "CTO", nextStep: "Schedule technical deep-dive", risks: [], createdAt: daysAgo(15), updatedAt: daysAgo(0), stageChangedAt: daysAgo(5), daysInStage: 5 },
  { id: "opp_4", title: "Full Platform — InnovateTech", accountId: "acc_4", accountName: "InnovateTech Corp", value: 720000, stage: "Qualification", probability: 40, ownerId: "usr_camila", ownerName: "Camila Souza", healthScore: 68, closeDate: daysFromNow(60), competitors: ["Salesforce", "Pipedrive"], champion: "Carlos Mendes", decisionMaker: "Board", nextStep: "Prepare business case presentation", risks: ["Long procurement cycle", "Multiple stakeholders"], createdAt: daysAgo(10), updatedAt: daysAgo(0), stageChangedAt: daysAgo(3), daysInStage: 3 },
  { id: "opp_5", title: "Retail Analytics Suite — NexGen", accountId: "acc_5", accountName: "NexGen Retail", value: 195000, stage: "Proposal", probability: 55, ownerId: "usr_lucas", ownerName: "Lucas Martins", healthScore: 58, closeDate: daysFromNow(25), competitors: ["HubSpot"], champion: "Fernanda Lima", decisionMaker: "Fernanda Lima", nextStep: "Follow up on proposal sent 5 days ago", risks: ["No response to proposal", "Budget approval pending"], createdAt: daysAgo(35), updatedAt: daysAgo(5), stageChangedAt: daysAgo(12), daysInStage: 12 },
  { id: "opp_6", title: "Revenue Operations — GreenEnergy", accountId: "acc_6", accountName: "GreenEnergy Solutions", value: 380000, stage: "Closed Won", probability: 100, ownerId: "usr_camila", ownerName: "Camila Souza", healthScore: 100, closeDate: daysAgo(5), competitors: ["Salesforce"], champion: "Lucas Ferreira", decisionMaker: "Lucas Ferreira", nextStep: "Handoff to CS team", risks: [], createdAt: daysAgo(50), updatedAt: daysAgo(5), stageChangedAt: daysAgo(5), daysInStage: 0 },
  { id: "opp_7", title: "SMB Package — EduSpark", accountId: "acc_3", accountName: "EduSpark Learning", value: 45000, stage: "Discovery", probability: 25, ownerId: "usr_lucas", ownerName: "Lucas Martins", healthScore: 60, closeDate: daysFromNow(40), competitors: [], champion: "Camila Rodrigues", decisionMaker: "CEO", nextStep: "Demo scheduled for Thursday", risks: ["Small budget"], createdAt: daysAgo(8), updatedAt: daysAgo(2), stageChangedAt: daysAgo(4), daysInStage: 4 },
  { id: "opp_8", title: "Expansion — TechNova (Module 2)", accountId: "acc_1", accountName: "TechNova Solutions", value: 150000, stage: "Qualification", probability: 35, ownerId: "usr_lucas", ownerName: "Lucas Martins", healthScore: 70, closeDate: daysFromNow(50), competitors: [], champion: "Maria Silva", decisionMaker: "CTO", nextStep: "Internal alignment meeting", risks: ["Depends on Module 1 success"], createdAt: daysAgo(5), updatedAt: daysAgo(1), stageChangedAt: daysAgo(2), daysInStage: 2 },
];

// ─── Pipeline Stages ─────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  { id: "stage_qual", name: "Qualification", order: 1, color: "#6B7280" },
  { id: "stage_disc", name: "Discovery", order: 2, color: "#3B82F6" },
  { id: "stage_prop", name: "Proposal", order: 3, color: "#8B5CF6" },
  { id: "stage_neg", name: "Negotiation", order: 4, color: "#D97706" },
  { id: "stage_won", name: "Closed Won", order: 5, color: "#0F9F6E" },
  { id: "stage_lost", name: "Closed Lost", order: 6, color: "#DC2626" },
];

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const MOCK_TASKS: Task[] = [
  { id: "task_1", title: "Follow up with Maria Silva — TechNova", type: "follow_up", status: "overdue", priority: "high", ownerId: "usr_ana", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", dueDate: daysAgo(1), createdAt: daysAgo(3), completedAt: null, description: "Send follow-up email after discovery call" },
  { id: "task_2", title: "Call João Pereira — DataFlow", type: "call", status: "overdue", priority: "high", ownerId: "usr_ana", relatedType: "lead", relatedId: "lead_2", relatedName: "João Pereira", dueDate: daysAgo(2), createdAt: daysAgo(5), completedAt: null, description: "Re-engage after no response to initial outreach" },
  { id: "task_3", title: "Send qualification email to Roberto Santos", type: "email", status: "today", priority: "medium", ownerId: "usr_rafael", relatedType: "lead", relatedId: "lead_6", relatedName: "Roberto Santos", dueDate: daysFromNow(0), createdAt: daysAgo(1), completedAt: null, description: "Initial outreach email with value proposition" },
  { id: "task_4", title: "Prepare proposal for TechNova", type: "review", status: "today", priority: "high", ownerId: "usr_lucas", relatedType: "opportunity", relatedId: "opp_1", relatedName: "Enterprise License — TechNova", dueDate: daysFromNow(0), createdAt: daysAgo(2), completedAt: null, description: "Finalize custom pricing and send revised proposal" },
  { id: "task_5", title: "Schedule discovery call — CloudBase", type: "meeting", status: "today", priority: "medium", ownerId: "usr_rafael", relatedType: "lead", relatedId: "lead_3", relatedName: "Ana Costa", dueDate: daysFromNow(0), createdAt: daysAgo(2), completedAt: null, description: "Book technical deep-dive with engineering team" },
  { id: "task_6", title: "Update forecast numbers", type: "update", status: "upcoming", priority: "medium", ownerId: "usr_lucas", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", dueDate: daysFromNow(2), createdAt: daysAgo(1), completedAt: null, description: "Adjust probability based on latest negotiation" },
  { id: "task_7", title: "Send WhatsApp to Fernanda Lima", type: "whatsapp", status: "overdue", priority: "medium", ownerId: "usr_ana", relatedType: "lead", relatedId: "lead_5", relatedName: "Fernanda Lima", dueDate: daysAgo(2), createdAt: daysAgo(4), completedAt: null, description: "Quick check-in after content download" },
  { id: "task_8", title: "Review NexGen proposal response", type: "review", status: "upcoming", priority: "high", ownerId: "usr_lucas", relatedType: "opportunity", relatedId: "opp_5", relatedName: "Retail Analytics Suite — NexGen", dueDate: daysFromNow(1), createdAt: daysAgo(1), completedAt: null, description: "Check if client responded to proposal" },
  { id: "task_9", title: "Approval request — DataFlow discount", type: "approval", status: "today", priority: "high", ownerId: "usr_bruno", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", dueDate: daysFromNow(0), createdAt: daysAgo(1), completedAt: null, description: "15% discount requires manager approval" },
  { id: "task_10", title: "Handoff meeting — GreenEnergy to CS", type: "meeting", status: "upcoming", priority: "medium", ownerId: "usr_camila", relatedType: "opportunity", relatedId: "opp_6", relatedName: "Revenue Operations — GreenEnergy", dueDate: daysFromNow(3), createdAt: daysAgo(5), completedAt: daysAgo(5), description: "Transition closed deal to customer success" },
  { id: "task_11", title: "Demo prep — EduSpark", type: "review", status: "upcoming", priority: "low", ownerId: "usr_lucas", relatedType: "opportunity", relatedId: "opp_7", relatedName: "SMB Package — EduSpark", dueDate: daysFromNow(2), createdAt: daysAgo(1), completedAt: null, description: "Prepare tailored demo for EdTech vertical" },
  { id: "task_12", title: "Follow up Juliana Alves — LogiSmart", type: "follow_up", status: "completed", priority: "medium", ownerId: "usr_ana", relatedType: "lead", relatedId: "lead_7", relatedName: "Juliana Alves", dueDate: daysAgo(1), createdAt: daysAgo(3), completedAt: daysAgo(1), description: "Post-demo follow-up with integration timeline" },
];

// ─── Meetings ────────────────────────────────────────────────────────────────

export const MOCK_MEETINGS: Meeting[] = [
  { id: "meet_1", title: "Discovery Call — TechNova", type: "discovery", date: hoursFromNow(2), duration: 45, attendees: ["Maria Silva", "Ana Beatriz Costa"], ownerId: "usr_ana", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva — TechNova", status: "scheduled", notes: "", location: "Google Meet" },
  { id: "meet_2", title: "Negotiation — DataFlow Analytics", type: "negotiation", date: hoursFromNow(5), duration: 60, attendees: ["João Pereira", "Lucas Martins", "Bruno Carvalho"], ownerId: "usr_lucas", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", status: "scheduled", notes: "", location: "Zoom" },
  { id: "meet_3", title: "Technical Deep-Dive — CloudBase", type: "demo", date: daysFromNow(1), duration: 60, attendees: ["Ana Costa", "Rafael Mendes"], ownerId: "usr_rafael", relatedType: "lead", relatedId: "lead_3", relatedName: "Ana Costa — CloudBase", status: "scheduled", notes: "Bring API documentation", location: "Google Meet" },
  { id: "meet_4", title: "Proposal Review — NexGen Retail", type: "proposal", date: daysFromNow(2), duration: 30, attendees: ["Fernanda Lima", "Lucas Martins"], ownerId: "usr_lucas", relatedType: "opportunity", relatedId: "opp_5", relatedName: "Retail Analytics Suite — NexGen", status: "scheduled", notes: "", location: "Teams" },
  { id: "meet_5", title: "Pipeline Review — Team Alpha", type: "internal", date: hoursFromNow(7), duration: 30, attendees: ["Patricia Ribeiro", "Ana Beatriz Costa", "Rafael Mendes"], ownerId: "usr_patricia", relatedType: "team", relatedId: "team_sdr_alpha", relatedName: "SDR Team Alpha", status: "scheduled", notes: "Weekly pipeline review", location: "Huddle" },
  { id: "meet_6", title: "Business Case Presentation — InnovateTech", type: "proposal", date: daysFromNow(5), duration: 90, attendees: ["Carlos Mendes", "Camila Souza", "Bruno Carvalho"], ownerId: "usr_camila", relatedType: "opportunity", relatedId: "opp_4", relatedName: "Full Platform — InnovateTech", status: "scheduled", notes: "Prepare ROI calculations", location: "In-person" },
  { id: "meet_7", title: "Discovery Call — TechNova (completed)", type: "discovery", date: daysAgo(7), duration: 45, attendees: ["Maria Silva", "Ana Beatriz Costa"], ownerId: "usr_ana", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva — TechNova", status: "completed", notes: "Identified key pain: 5+ tool integration overhead. Budget: $400-500K. Timeline: Q1 decision.", location: "Google Meet" },
  { id: "meet_8", title: "Demo — LogiSmart", type: "demo", date: daysAgo(3), duration: 60, attendees: ["Juliana Alves", "Ana Beatriz Costa"], ownerId: "usr_ana", relatedType: "lead", relatedId: "lead_7", relatedName: "Juliana Alves — LogiSmart", status: "completed", notes: "SAP integration is critical. Need to involve SE team for feasibility.", location: "Google Meet" },
];

// ─── Activity Timeline ───────────────────────────────────────────────────────

export const MOCK_ACTIVITIES: Activity[] = [
  { id: "act_1", type: "email", summary: "Sent initial outreach email", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", createdAt: daysAgo(14), source: "gmail", confidence: 100, tags: ["outbound", "first-touch"] },
  { id: "act_2", type: "email_reply", summary: "Maria replied — interested in learning more", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", createdAt: daysAgo(12), source: "gmail", confidence: 100, tags: ["inbound", "positive-signal"] },
  { id: "act_3", type: "call", summary: "15-minute qualification call — confirmed pain points", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", createdAt: daysAgo(10), source: "twilio", confidence: 95, tags: ["qualification", "positive"] },
  { id: "act_4", type: "meeting", summary: "Discovery call — identified 5+ tool integration overhead", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", createdAt: daysAgo(7), source: "google_calendar", confidence: 100, tags: ["discovery", "deep-dive"] },
  { id: "act_5", type: "note", summary: "Budget range confirmed: $400-500K. Decision timeline: Q1.", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", createdAt: daysAgo(7), source: "manual", confidence: 90, tags: ["budget", "timeline"] },
  { id: "act_6", type: "stage_change", summary: "Lead moved from CONTACTED to QUALIFIED", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", createdAt: daysAgo(7), source: "system", confidence: 100, tags: ["stage-change"] },
  { id: "act_7", type: "whatsapp", summary: "Quick check-in: Maria confirmed interest in proposal", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_1", relatedName: "Maria Silva", createdAt: daysAgo(3), source: "whatsapp", confidence: 95, tags: ["engagement", "positive"] },
  { id: "act_8", type: "email", summary: "Sent LinkedIn connection and intro message", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_2", relatedName: "João Pereira", createdAt: daysAgo(21), source: "linkedin", confidence: 100, tags: ["outbound", "first-touch"] },
  { id: "act_9", type: "email", summary: "Follow-up email sent — no response yet", userId: "usr_ana", userName: "Ana Beatriz Costa", relatedType: "lead", relatedId: "lead_2", relatedName: "João Pereira", createdAt: daysAgo(14), source: "gmail", confidence: 100, tags: ["follow-up", "no-response"] },
  { id: "act_10", type: "system", summary: "Auto-flagged: 3 days without response", userId: "system", userName: "Aexion AI", relatedType: "lead", relatedId: "lead_2", relatedName: "João Pereira", createdAt: daysAgo(3), source: "system", confidence: 100, tags: ["alert", "no-response"] },
  { id: "act_11", type: "stage_change", summary: "Opportunity moved from Proposal to Negotiation", userId: "usr_lucas", userName: "Lucas Martins", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", createdAt: daysAgo(14), source: "system", confidence: 100, tags: ["stage-change", "pipeline"] },
  { id: "act_12", type: "call", summary: "Pricing discussion — client requested 15% discount", userId: "usr_lucas", userName: "Lucas Martins", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", createdAt: daysAgo(7), source: "twilio", confidence: 95, tags: ["negotiation", "discount"] },
  { id: "act_13", type: "approval", summary: "Discount approval requested from manager", userId: "usr_lucas", userName: "Lucas Martins", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", createdAt: daysAgo(1), source: "system", confidence: 100, tags: ["approval", "pending"] },
  { id: "act_14", type: "meeting", summary: "Won deal — signed contract", userId: "usr_camila", userName: "Camila Souza", relatedType: "opportunity", relatedId: "opp_6", relatedName: "Revenue Operations — GreenEnergy", createdAt: daysAgo(5), source: "system", confidence: 100, tags: ["closed-won", "celebration"] },
];

// ─── Insights ────────────────────────────────────────────────────────────────

export const MOCK_INSIGHTS: Insight[] = [
  { id: "ins_1", title: "Lead without response for 3+ days", description: "João Pereira (DataFlow) hasn't responded in 3 days after 2 outreach attempts. Engagement is declining.", impact: "high", action: "Try reaching via WhatsApp or phone. Consider changing approach.", confidence: 88, source: "Activity analysis", relatedType: "lead", relatedId: "lead_2", relatedName: "João Pereira — DataFlow", category: "engagement", createdAt: daysAgo(0) },
  { id: "ins_2", title: "Opportunity stuck in Negotiation for 14 days", description: "Platform Migration — DataFlow has been in Negotiation stage for 14 days without meaningful progress. Average for this stage is 7 days.", impact: "high", action: "Schedule urgent call to address objections. Consider involving manager.", confidence: 92, source: "Pipeline velocity analysis", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", category: "pipeline", createdAt: daysAgo(0) },
  { id: "ins_3", title: "Champion went quiet — DataFlow", description: "João Pereira, the champion at DataFlow, hasn't engaged in the last 7 days. Previous engagement cadence was every 2-3 days.", impact: "high", action: "Re-engage via personal channel. Verify if champion is still in role.", confidence: 85, source: "Contact engagement tracking", relatedType: "opportunity", relatedId: "opp_2", relatedName: "Platform Migration — DataFlow", category: "risk", createdAt: daysAgo(1) },
  { id: "ins_4", title: "No next step defined — NexGen Retail", description: "Retail Analytics Suite opportunity has no scheduled next step. Proposal was sent 5 days ago with no follow-up.", impact: "medium", action: "Schedule follow-up call or send a check-in email.", confidence: 90, source: "Activity gap analysis", relatedType: "opportunity", relatedId: "opp_5", relatedName: "Retail Analytics Suite — NexGen", category: "execution", createdAt: daysAgo(0) },
  { id: "ins_5", title: "Forecast inconsistency detected", description: "Lucas Martins has $500K in committed forecast but only 2 active interactions this week. Historical data shows committed deals require 5+ weekly touchpoints.", impact: "high", action: "Review forecast assumptions and increase activity on committed deals.", confidence: 78, source: "Forecast vs. activity correlation", relatedType: "user", relatedId: "usr_lucas", relatedName: "Lucas Martins", category: "forecast", createdAt: daysAgo(0) },
  { id: "ins_6", title: "Recurring objection: Budget constraints", description: "3 out of 8 active leads cited budget constraints in the last 2 weeks. This represents a 40% increase from the previous period.", impact: "medium", action: "Review value proposition messaging. Consider ROI-focused approach.", confidence: 82, source: "Objection pattern analysis", relatedType: "team", relatedId: "team_sdr_alpha", relatedName: "SDR Team Alpha", category: "pattern", createdAt: daysAgo(1) },
  { id: "ins_7", title: "High-value pipeline bottleneck at Proposal stage", description: "$645K in pipeline value is stuck at Proposal stage. 2 opportunities have been there for 8+ days.", impact: "high", action: "Review proposals and accelerate follow-ups. Consider pricing adjustments.", confidence: 87, source: "Pipeline flow analysis", relatedType: "pipeline", relatedId: "stage_prop", relatedName: "Proposal Stage", category: "pipeline", createdAt: daysAgo(0) },
  { id: "ins_8", title: "SDR Ana — high volume, conversion opportunity", description: "Ana Beatriz Costa has 5 active leads but only 1 qualified conversion this month. Volume is good but qualification rate can improve.", impact: "medium", action: "Review qualification criteria with manager. Consider coaching session.", confidence: 75, source: "Rep performance analysis", relatedType: "user", relatedId: "usr_ana", relatedName: "Ana Beatriz Costa", category: "performance", createdAt: daysAgo(2) },
];

// ─── Inbox Messages ──────────────────────────────────────────────────────────

export const MOCK_INBOX: InboxMessage[] = [
  { id: "msg_1", channel: "whatsapp", from: "Maria Silva", fromCompany: "TechNova", subject: "", preview: "Hi Ana! Just checking — when can we see the revised proposal?", relatedType: "lead", relatedId: "lead_1", ownerId: "usr_ana", isRead: false, isResolved: false, createdAt: hoursFromNow(-2), threadId: "thread_1" },
  { id: "msg_2", channel: "email", from: "Juliana Alves", fromCompany: "LogiSmart", subject: "RE: SAP Integration Timeline", preview: "Thanks for the demo! We need SAP integration details before moving forward...", relatedType: "lead", relatedId: "lead_7", ownerId: "usr_ana", isRead: false, isResolved: false, createdAt: hoursFromNow(-4), threadId: "thread_2" },
  { id: "msg_3", channel: "email", from: "Carlos Mendes", fromCompany: "InnovateTech", subject: "Business Case Feedback", preview: "We've reviewed the initial materials. The board wants to see ROI projections...", relatedType: "opportunity", relatedId: "opp_4", ownerId: "usr_camila", isRead: true, isResolved: false, createdAt: hoursFromNow(-6), threadId: "thread_3" },
  { id: "msg_4", channel: "whatsapp", from: "Fernanda Lima", fromCompany: "NexGen Retail", subject: "", preview: "Hey, sorry for the delay. We're still reviewing the proposal internally.", relatedType: "opportunity", relatedId: "opp_5", ownerId: "usr_lucas", isRead: false, isResolved: false, createdAt: hoursFromNow(-8), threadId: "thread_4" },
  { id: "msg_5", channel: "call", from: "João Pereira", fromCompany: "DataFlow", subject: "Missed Call", preview: "Missed call from João Pereira — no voicemail left", relatedType: "lead", relatedId: "lead_2", ownerId: "usr_ana", isRead: true, isResolved: false, createdAt: daysAgo(1), threadId: "thread_5" },
  { id: "msg_6", channel: "internal", from: "Bruno Carvalho", fromCompany: "Aexion", subject: "DataFlow discount approval needed", preview: "Lucas requested 15% discount on DataFlow deal. Please review.", relatedType: "opportunity", relatedId: "opp_2", ownerId: "usr_bruno", isRead: false, isResolved: false, createdAt: daysAgo(1), threadId: "thread_6" },
  { id: "msg_7", channel: "email", from: "Lucas Ferreira", fromCompany: "GreenEnergy", subject: "Implementation Kickoff", preview: "Looking forward to starting next week. Can you send the onboarding docs?", relatedType: "opportunity", relatedId: "opp_6", ownerId: "usr_camila", isRead: true, isResolved: true, createdAt: daysAgo(3), threadId: "thread_7" },
  { id: "msg_8", channel: "whatsapp", from: "Camila Rodrigues", fromCompany: "EduSpark", subject: "", preview: "We're a small team but very interested. Can we do a shorter pilot?", relatedType: "lead", relatedId: "lead_9", ownerId: "usr_ana", isRead: false, isResolved: false, createdAt: hoursFromNow(-1), threadId: "thread_8" },
];

// ─── Integrations ────────────────────────────────────────────────────────────

export const MOCK_INTEGRATIONS: Integration[] = [
  { id: "int_1", name: "HubSpot", category: "CRM", icon: "🟠", status: "connected", lastSync: daysAgo(0), eventsReceived: 1247, eventsSent: 389, health: 98, scopes: ["contacts.read", "deals.read", "deals.write"], fieldMappings: 24 },
  { id: "int_2", name: "Gmail", category: "Email", icon: "📧", status: "connected", lastSync: hoursFromNow(-1), eventsReceived: 3891, eventsSent: 892, health: 100, scopes: ["mail.read", "mail.send", "mail.compose"], fieldMappings: 8 },
  { id: "int_3", name: "Google Calendar", category: "Calendar", icon: "📅", status: "connected", lastSync: hoursFromNow(-1), eventsReceived: 456, eventsSent: 123, health: 100, scopes: ["calendar.read", "calendar.write"], fieldMappings: 6 },
  { id: "int_4", name: "WhatsApp", category: "Messaging", icon: "💬", status: "connected", lastSync: hoursFromNow(0), eventsReceived: 2134, eventsSent: 567, health: 95, scopes: ["messages.read", "messages.send"], fieldMappings: 5 },
  { id: "int_5", name: "Slack", category: "Collaboration", icon: "💼", status: "connected", lastSync: hoursFromNow(-2), eventsReceived: 890, eventsSent: 234, health: 100, scopes: ["channels.read", "messages.write"], fieldMappings: 3 },
  { id: "int_6", name: "Salesforce", category: "CRM", icon: "☁️", status: "disconnected", lastSync: daysAgo(15), eventsReceived: 0, eventsSent: 0, health: 0, scopes: [], fieldMappings: 0 },
  { id: "int_7", name: "Pipedrive", category: "CRM", icon: "🔵", status: "disconnected", lastSync: "", eventsReceived: 0, eventsSent: 0, health: 0, scopes: [], fieldMappings: 0 },
  { id: "int_8", name: "Twilio", category: "Voice", icon: "📞", status: "connected", lastSync: hoursFromNow(-3), eventsReceived: 567, eventsSent: 234, health: 92, scopes: ["calls.read", "calls.create"], fieldMappings: 4 },
  { id: "int_9", name: "Outlook", category: "Email", icon: "📨", status: "disconnected", lastSync: "", eventsReceived: 0, eventsSent: 0, health: 0, scopes: [], fieldMappings: 0 },
  { id: "int_10", name: "n8n", category: "Automation", icon: "⚡", status: "connected", lastSync: daysAgo(1), eventsReceived: 234, eventsSent: 89, health: 88, scopes: ["workflows.trigger", "webhooks.receive"], fieldMappings: 12 },
  { id: "int_11", name: "Zapier", category: "Automation", icon: "🔄", status: "disconnected", lastSync: "", eventsReceived: 0, eventsSent: 0, health: 0, scopes: [], fieldMappings: 0 },
  { id: "int_12", name: "Webhook", category: "Custom", icon: "🔗", status: "connected", lastSync: hoursFromNow(-5), eventsReceived: 45, eventsSent: 12, health: 100, scopes: ["custom"], fieldMappings: 0 },
];

// ─── Playbooks ───────────────────────────────────────────────────────────────

export const MOCK_PLAYBOOKS: Playbook[] = [
  { id: "pb_1", title: "Enterprise Outbound Cadence", category: "Outbound", stage: "Prospecting", segment: "Enterprise", description: "8-touch sequence for enterprise prospects. Combines LinkedIn, email, and phone over 21 days.", steps: 8, avgConversion: 12, usageCount: 156, updatedAt: daysAgo(5) },
  { id: "pb_2", title: "Inbound Lead Qualification", category: "Qualification", stage: "Qualification", segment: "All", description: "Framework for qualifying inbound leads using BANT + MEDDIC hybrid approach.", steps: 5, avgConversion: 28, usageCount: 234, updatedAt: daysAgo(3) },
  { id: "pb_3", title: "Discovery Call Framework", category: "Discovery", stage: "Discovery", segment: "Mid-Market", description: "Structured discovery call with pain-first approach. Includes question templates and note framework.", steps: 6, avgConversion: 45, usageCount: 189, updatedAt: daysAgo(7) },
  { id: "pb_4", title: "Objection Handling — Price", category: "Objections", stage: "Negotiation", segment: "All", description: "Scripts and strategies for handling price objections. Includes ROI calculator talking points.", steps: 4, avgConversion: 35, usageCount: 312, updatedAt: daysAgo(2) },
  { id: "pb_5", title: "Objection Handling — Competitor", category: "Objections", stage: "Negotiation", segment: "Enterprise", description: "Competitive positioning against Salesforce, HubSpot, and Pipedrive. Battle cards included.", steps: 3, avgConversion: 30, usageCount: 145, updatedAt: daysAgo(10) },
  { id: "pb_6", title: "Proposal Follow-up Sequence", category: "Follow-up", stage: "Proposal", segment: "All", description: "5-day follow-up sequence after proposal delivery. Multi-channel approach.", steps: 5, avgConversion: 52, usageCount: 98, updatedAt: daysAgo(4) },
  { id: "pb_7", title: "Champion Building Playbook", category: "Relationship", stage: "Discovery", segment: "Enterprise", description: "Strategies for identifying and nurturing internal champions. Includes stakeholder mapping.", steps: 7, avgConversion: 40, usageCount: 67, updatedAt: daysAgo(14) },
  { id: "pb_8", title: "Closed-Lost Recovery", category: "Recovery", stage: "Closed Lost", segment: "All", description: "Re-engagement playbook for lost deals. 90-day nurture sequence with value-first approach.", steps: 6, avgConversion: 8, usageCount: 43, updatedAt: daysAgo(21) },
];

// ─── Forecast ────────────────────────────────────────────────────────────────

export const MOCK_FORECAST: ForecastSnapshot[] = [
  { id: "fc_1", userId: "usr_lucas", userName: "Lucas Martins", period: "2026-Q1", commit: 730000, bestCase: 1100000, pipeline: 1875000, closed: 380000, target: 900000, accuracy: 82, updatedAt: daysAgo(0) },
  { id: "fc_2", userId: "usr_camila", userName: "Camila Souza", period: "2026-Q1", commit: 520000, bestCase: 900000, pipeline: 1325000, closed: 380000, target: 750000, accuracy: 88, updatedAt: daysAgo(0) },
];

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: "audit_1", userId: "usr_ana", userName: "Ana Beatriz Costa", action: "lead.status_changed", object: "Lead", objectId: "lead_1", objectName: "Maria Silva", details: "Status changed from CONTACTED to QUALIFIED", source: "web_app", createdAt: daysAgo(7) },
  { id: "audit_2", userId: "usr_lucas", userName: "Lucas Martins", action: "opportunity.stage_changed", object: "Opportunity", objectId: "opp_2", objectName: "Platform Migration — DataFlow", details: "Stage changed from Proposal to Negotiation", source: "web_app", createdAt: daysAgo(14) },
  { id: "audit_3", userId: "usr_lucas", userName: "Lucas Martins", action: "approval.requested", object: "Opportunity", objectId: "opp_2", objectName: "Platform Migration — DataFlow", details: "Discount approval requested: 15% off standard pricing", source: "web_app", createdAt: daysAgo(1) },
  { id: "audit_4", userId: "usr_camila", userName: "Camila Souza", action: "opportunity.closed_won", object: "Opportunity", objectId: "opp_6", objectName: "Revenue Operations — GreenEnergy", details: "Deal closed at $380,000. Contract signed.", source: "web_app", createdAt: daysAgo(5) },
  { id: "audit_5", userId: "system", userName: "System", action: "integration.synced", object: "Integration", objectId: "int_1", objectName: "HubSpot", details: "Full sync completed. 47 contacts updated, 3 new deals imported.", source: "integration", createdAt: daysAgo(0) },
  { id: "audit_6", userId: "usr_patricia", userName: "Patricia Ribeiro", action: "user.role_changed", object: "User", objectId: "usr_rafael", objectName: "Rafael Mendes", details: "Role changed from Viewer to SDR", source: "web_app", createdAt: daysAgo(30) },
  { id: "audit_7", userId: "usr_bruno", userName: "Bruno Carvalho", action: "opportunity.reassigned", object: "Opportunity", objectId: "opp_3", objectName: "API Integration — CloudBase", details: "Owner changed from Lucas Martins to Camila Souza", source: "web_app", createdAt: daysAgo(15) },
  { id: "audit_8", userId: "system", userName: "System", action: "webhook.received", object: "WebhookEvent", objectId: "wh_1", objectName: "HubSpot Contact Update", details: "Received webhook from HubSpot: contact updated — maria@technova.io", source: "webhook", createdAt: daysAgo(2) },
];

// ─── Webhook Events ──────────────────────────────────────────────────────────

export const MOCK_WEBHOOK_EVENTS: WebhookEvent[] = [
  { id: "wh_1", type: "contact.updated", connector: "HubSpot", status: "processed", payload: '{"contact_id":"12345","email":"maria@technova.io","updated_fields":["phone","title"]}', objectType: "Contact", objectId: "cnt_1", createdAt: daysAgo(0), processedAt: daysAgo(0), retries: 0 },
  { id: "wh_2", type: "deal.stage_changed", connector: "HubSpot", status: "processed", payload: '{"deal_id":"67890","new_stage":"negotiation","old_stage":"proposal"}', objectType: "Opportunity", objectId: "opp_2", createdAt: daysAgo(1), processedAt: daysAgo(1), retries: 0 },
  { id: "wh_3", type: "email.received", connector: "Gmail", status: "processed", payload: '{"message_id":"abc123","from":"maria@technova.io","subject":"RE: Proposal"}', objectType: "Message", objectId: "msg_1", createdAt: daysAgo(0), processedAt: daysAgo(0), retries: 0 },
  { id: "wh_4", type: "call.completed", connector: "Twilio", status: "processed", payload: '{"call_sid":"CA123","duration":847,"from":"+5511999","to":"+5511988"}', objectType: "Call", objectId: "call_1", createdAt: daysAgo(2), processedAt: daysAgo(2), retries: 0 },
  { id: "wh_5", type: "message.received", connector: "WhatsApp", status: "failed", payload: '{"message_id":"wa_456","from":"+5511987654321","body":"Hi, checking on proposal"}', objectType: "Message", objectId: "msg_5", createdAt: daysAgo(0), processedAt: null, retries: 3 },
  { id: "wh_6", type: "workflow.triggered", connector: "n8n", status: "processed", payload: '{"workflow_id":"wf_789","trigger":"new_lead","lead_email":"roberto@finpro.com.br"}', objectType: "Lead", objectId: "lead_6", createdAt: daysAgo(1), processedAt: daysAgo(1), retries: 0 },
  { id: "wh_7", type: "calendar.event_created", connector: "Google Calendar", status: "processed", payload: '{"event_id":"gc_101","title":"Discovery Call — CloudBase","date":"2026-03-19T10:00:00Z"}', objectType: "Meeting", objectId: "meet_3", createdAt: daysAgo(2), processedAt: daysAgo(2), retries: 0 },
  { id: "wh_8", type: "contact.created", connector: "HubSpot", status: "queued", payload: '{"contact_id":"99999","email":"new@prospect.com","source":"form_submission"}', objectType: "Contact", objectId: null, createdAt: hoursFromNow(-1), processedAt: null, retries: 0 },
];
