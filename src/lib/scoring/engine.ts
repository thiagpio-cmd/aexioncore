import { Lead, Opportunity, Company, Contact, Stage } from "@prisma/client";

export type PersonaType = "Decision Maker" | "Champion" | "Evaluator" | "Gatekeeper" | "Unknown";

export interface ScoreResult {
  score: number; // 0-100
  persona: PersonaType;
  signals: {
    positive: string[];
    negative: string[];
  };
  risks: string[];
}

// --- Persona Mapping ---

const DECISION_MAKER_KEYWORDS = ["ceo", "cto", "cfo", "cco", "coo", "cmo", "founder", "owner", "president", "vp", "vice president", "director", "head", "chief"];
const CHAMPION_KEYWORDS = ["manager", "lead", "senior", "principal", "architect", "supervisor"];
const GATEKEEPER_KEYWORDS = ["assistant", "coordinator", "admin", "secretary", "intern", "associate"];

export function inferPersona(title?: string | null): PersonaType {
  if (!title) return "Unknown";
  
  const lowerTitle = title.toLowerCase();
  
  if (DECISION_MAKER_KEYWORDS.some(kw => lowerTitle.includes(kw))) return "Decision Maker";
  if (CHAMPION_KEYWORDS.some(kw => lowerTitle.includes(kw))) return "Champion";
  if (GATEKEEPER_KEYWORDS.some(kw => lowerTitle.includes(kw))) return "Gatekeeper";
  
  return "Evaluator"; // Default for generic titles
}

// --- Lead Fit Scoring ---

type LeadWithRelations = Partial<Lead> & {
  company?: Partial<Company> | null;
  contact?: Partial<Contact> | null;
};

export function calculateLeadFit(lead: LeadWithRelations): ScoreResult {
  let score = 30; // Base score
  const positive: string[] = [];
  const negative: string[] = [];
  const risks: string[] = [];

  // Persona check
  const persona = inferPersona(lead.title);
  if (persona === "Decision Maker") {
    score += 20;
    positive.push("Title indicates Executive / Decision Maker authority.");
  } else if (persona === "Champion") {
    score += 10;
    positive.push("Title indicates Management / Technical Champion.");
  } else if (persona === "Gatekeeper") {
    score -= 10;
    negative.push("Title indicates Administrative / Gatekeeper role.");
  }

  // Company validation
  const genericCompanies = ["personal", "freelance", "student", "self", "none"];
  const companyName = lead.company?.name || "";
  
  if (companyName && genericCompanies.includes(companyName.toLowerCase())) {
    score -= 10;
    negative.push("Company name implies individual or student rather than B2B target.");
  } else if (companyName) {
    score += 10;
    positive.push("Valid Company Name provided.");
  }

  // Industry & Size
  if (lead.company?.industry) {
    score += 5;
    positive.push(`Industry explicitly defined (${lead.company.industry}).`);
  }
  
  if (lead.company?.size) {
    score += 10;
    positive.push(`Company size is documented (${lead.company.size}).`);
  }

  // Missing crucial Contact info
  if (!lead.title && !lead.phone) {
    score -= 10;
    risks.push("Missing foundational contact data (Job Title, Phone).");
  } else if (lead.phone) {
    score += 10;
    positive.push("Direct phone number is available.");
  }

  // Status penalties
  if (lead.status === "UNQUALIFIED") {
    score = Math.min(score, 10);
    risks.push("Explicitly marked as UNQUALIFIED by an operator.");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    persona,
    signals: { positive, negative },
    risks,
  };
}

// --- Opportunity Conversion Probability ---

type OpportunityWithRelations = Partial<Opportunity> & {
  stageRelation?: Partial<Stage> | null;
  primaryContact?: Partial<Contact> | null;
};

export function calculateOpportunityProbability(
  opportunity: OpportunityWithRelations
): ScoreResult {
  // Base score off the Pipeline Stage's mechanical probability, or default heuristic
  let score = opportunity.probability ?? 10;
  
  // If we can infer persona from the primary contact
  const persona = inferPersona(opportunity.primaryContact?.title);
  
  const positive: string[] = [];
  const negative: string[] = [];
  const risks: string[] = [];

  if (persona === "Decision Maker") {
    score += 15;
    positive.push("Primary contact is an Executive / Decision Maker.");
  } else if (persona === "Unknown") {
    negative.push("Primary contact lacks a qualified title.");
  }

  // Deal Value Validation
  if (opportunity.value && opportunity.value > 0) {
    score += 10;
    positive.push(`Deal value is quantified ($${opportunity.value.toLocaleString()}).`);
  } else {
    risks.push("Deal does not have a quantified expected value.");
    score -= 10;
  }

  // Description / Scope density
  if (opportunity.description && opportunity.description.length > 50) {
    score += 5;
    positive.push("Opportunity scope/description is well documented.");
  } else {
    negative.push("Brief or missing project description.");
  }

  // Timeline Validation
  if (opportunity.expectedCloseDate) {
    const now = new Date();
    const expected = opportunity.expectedCloseDate instanceof Date 
      ? opportunity.expectedCloseDate 
      : new Date(opportunity.expectedCloseDate);
      
    const daysUntilClose = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilClose < 0) {
      score -= 20;
      risks.push(`Close date is in the past (${Math.abs(daysUntilClose)} days overdue).`);
    } else if (daysUntilClose <= 30) {
      score += 5;
      positive.push(`Close date is rapidly approaching (Within 30 days).`);
    } else if (daysUntilClose > 180) {
      negative.push("Close date is highly speculative (>6 months out).");
    }
  } else {
    risks.push("No target close date is set. Deal lacks urgency.");
    score -= 15;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    persona,
    signals: { positive, negative },
    risks,
  };
}
