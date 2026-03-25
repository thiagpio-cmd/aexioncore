import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { sendSuccess, sendError } from "@/lib/api-response";
import { unauthorized, badRequest } from "@/lib/errors";
import { authOptions } from "@/lib/auth";
import { openaiTaskProvider } from "@/lib/ai/providers/openai-tasks";
import { prisma } from "@/lib/db";

/**
 * POST /api/ai/generate-email
 *
 * Generates a personalized sales email using full CRM context.
 * Uses OpenAI gpt-4o-mini when available, falls back to deterministic templates.
 *
 * Body: {
 *   leadId?: string,
 *   opportunityId?: string,
 *   contactEmail: string,
 *   contactName: string,
 *   purpose: "follow_up" | "introduction" | "proposal" | "meeting_request" | "objection_handling" | "check_in" | "thank_you",
 *   tone: "professional" | "friendly" | "urgent" | "consultative",
 *   additionalContext?: string,
 *   language?: string
 * }
 */

type EmailPurpose = "follow_up" | "introduction" | "proposal" | "meeting_request" | "objection_handling" | "check_in" | "thank_you";
type EmailTone = "professional" | "friendly" | "urgent" | "consultative";

const VALID_PURPOSES: EmailPurpose[] = ["follow_up", "introduction", "proposal", "meeting_request", "objection_handling", "check_in", "thank_you"];
const VALID_TONES: EmailTone[] = ["professional", "friendly", "urgent", "consultative"];

const PURPOSE_LABELS: Record<EmailPurpose, string> = {
  follow_up: "Follow Up",
  introduction: "Introduction",
  proposal: "Proposal",
  meeting_request: "Meeting Request",
  objection_handling: "Objection Handling",
  check_in: "Check-in",
  thank_you: "Thank You",
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return sendError(unauthorized());

    const body = await request.json();
    const {
      leadId,
      opportunityId,
      contactEmail,
      contactName,
      purpose,
      tone,
      additionalContext,
      language = "en",
    } = body;

    if (!contactName) return sendError(badRequest("contactName is required"));
    if (!purpose || !VALID_PURPOSES.includes(purpose)) {
      return sendError(badRequest(`purpose must be one of: ${VALID_PURPOSES.join(", ")}`));
    }
    if (!tone || !VALID_TONES.includes(tone)) {
      return sendError(badRequest(`tone must be one of: ${VALID_TONES.join(", ")}`));
    }

    // ── Load CRM context ──────────────────────────────────────────────
    const crmContext = await loadCRMContext(leadId, opportunityId);

    // ── Try OpenAI first ──────────────────────────────────────────────
    if (openaiTaskProvider.isConfigured()) {
      try {
        const prompt = buildPrompt({
          contactName,
          contactEmail,
          purpose,
          tone,
          additionalContext,
          language,
          crmContext,
          senderName: (session.user as any).name || "Sales Team",
        });

        const result = await openaiTaskProvider.generateText(prompt, {
          maxTokens: 1024,
          temperature: 0.4,
          systemInstruction:
            "You are an expert B2B sales copywriter. Write compelling, personalized emails that feel human and drive action. Always output valid JSON with exactly two keys: \"subject\" and \"body\". No markdown, no code fences.",
        });

        try {
          const cleaned = result.text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return sendSuccess({
            subject: parsed.subject || "",
            body: parsed.body || "",
            tone,
            purpose,
            provider: "openai",
          });
        } catch {
          // If JSON parsing fails, try to extract subject/body
          const lines = result.text.trim().split("\n");
          const subjectLine = lines.find((l: string) => l.toLowerCase().startsWith("subject:"));
          const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : `${PURPOSE_LABELS[purpose as EmailPurpose] || purpose} - ${contactName}`;
          const bodyText = lines
            .filter((l: string) => !l.toLowerCase().startsWith("subject:"))
            .join("\n")
            .trim();
          return sendSuccess({
            subject,
            body: bodyText || result.text,
            tone,
            purpose,
            provider: "openai",
          });
        }
      } catch (err) {
        console.warn("OpenAI email generation failed:", err);
      }
    }

    // ── Deterministic fallback ────────────────────────────────────────
    const fallback = generateDeterministicEmail({
      contactName,
      contactEmail,
      purpose,
      tone,
      additionalContext,
      crmContext,
      senderName: (session.user as any).name || "Sales Team",
    });

    return sendSuccess({
      subject: fallback.subject,
      body: fallback.body,
      tone,
      purpose,
      provider: "deterministic",
    });
  } catch (error: any) {
    console.error("POST /api/ai/generate-email error:", error);
    return sendSuccess({
      subject: "Following Up",
      body: "Hi,\n\nI wanted to reach out and connect. Would you have time for a quick conversation this week?\n\nBest regards",
      tone: "professional",
      purpose: "follow_up",
      provider: "fallback",
    });
  }
}

// ── CRM Context Loader ─────────────────────────────────────────────────

interface CRMContext {
  lead?: {
    name: string;
    email: string;
    title?: string;
    status: string;
    temperature: string;
    source: string;
    fitScore: number;
    companyName?: string;
    companyIndustry?: string;
    companySize?: string;
    lastContact?: string;
  };
  opportunity?: {
    title: string;
    value: number;
    stage: string;
    probability: number;
    expectedCloseDate?: string;
    description?: string;
  };
  recentActivities: Array<{
    type: string;
    subject?: string;
    body?: string;
    createdAt: string;
  }>;
}

async function loadCRMContext(
  leadId?: string,
  opportunityId?: string
): Promise<CRMContext> {
  const context: CRMContext = { recentActivities: [] };

  try {
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          company: { select: { name: true, industry: true, size: true } },
        },
      });

      if (lead) {
        context.lead = {
          name: lead.name,
          email: lead.email,
          title: lead.title || undefined,
          status: lead.status,
          temperature: lead.temperature,
          source: lead.source,
          fitScore: lead.fitScore,
          companyName: lead.company?.name,
          companyIndustry: lead.company?.industry || undefined,
          companySize: lead.company?.size || undefined,
          lastContact: lead.lastContact?.toISOString(),
        };
      }

      // Recent activities for this lead
      const activities = await prisma.activity.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { type: true, subject: true, body: true, createdAt: true },
      });

      context.recentActivities = activities.map((a) => ({
        type: a.type,
        subject: a.subject || undefined,
        body: a.body ? a.body.substring(0, 200) : undefined,
        createdAt: a.createdAt.toISOString(),
      }));
    }

    if (opportunityId) {
      const opp = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          account: {
            include: {
              company: { select: { name: true, industry: true, size: true } },
            },
          },
        },
      });

      if (opp) {
        context.opportunity = {
          title: opp.title,
          value: opp.value,
          stage: opp.stage,
          probability: opp.probability,
          expectedCloseDate: opp.expectedCloseDate?.toISOString(),
          description: opp.description || undefined,
        };

        // Enrich with company data if not already loaded from lead
        if (!context.lead && opp.account?.company) {
          context.lead = {
            name: "",
            email: "",
            status: "",
            temperature: "",
            source: "",
            fitScore: 0,
            companyName: opp.account.company.name,
            companyIndustry: opp.account.company.industry || undefined,
            companySize: opp.account.company.size || undefined,
          };
        }
      }

      // Recent activities for this opportunity
      if (!leadId) {
        const activities = await prisma.activity.findMany({
          where: { opportunityId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { type: true, subject: true, body: true, createdAt: true },
        });

        context.recentActivities = activities.map((a) => ({
          type: a.type,
          subject: a.subject || undefined,
          body: a.body ? a.body.substring(0, 200) : undefined,
          createdAt: a.createdAt.toISOString(),
        }));
      }
    }
  } catch (err) {
    console.warn("Error loading CRM context for email generation:", err);
  }

  return context;
}

// ── Prompt Builder ──────────────────────────────────────────────────────

function buildPrompt(params: {
  contactName: string;
  contactEmail?: string;
  purpose: EmailPurpose;
  tone: EmailTone;
  additionalContext?: string;
  language: string;
  crmContext: CRMContext;
  senderName: string;
}): string {
  const { contactName, purpose, tone, additionalContext, language, crmContext, senderName } = params;

  let contextBlock = "";

  if (crmContext.lead) {
    const l = crmContext.lead;
    contextBlock += `\n--- Lead/Contact Info ---
Name: ${l.name || contactName}
${l.title ? `Title: ${l.title}` : ""}
${l.companyName ? `Company: ${l.companyName}` : ""}
${l.companyIndustry ? `Industry: ${l.companyIndustry}` : ""}
${l.companySize ? `Company Size: ${l.companySize}` : ""}
Status: ${l.status}
Temperature: ${l.temperature}
Lead Source: ${l.source}
Fit Score: ${l.fitScore}/100
${l.lastContact ? `Last Contact: ${new Date(l.lastContact).toLocaleDateString()}` : "No previous contact"}`;
  }

  if (crmContext.opportunity) {
    const o = crmContext.opportunity;
    contextBlock += `\n--- Opportunity ---
Deal: ${o.title}
Value: $${o.value.toLocaleString()}
Stage: ${o.stage}
Probability: ${o.probability}%
${o.expectedCloseDate ? `Expected Close: ${new Date(o.expectedCloseDate).toLocaleDateString()}` : ""}
${o.description ? `Description: ${o.description}` : ""}`;
  }

  if (crmContext.recentActivities.length > 0) {
    contextBlock += `\n--- Recent Interactions ---`;
    for (const a of crmContext.recentActivities.slice(0, 3)) {
      contextBlock += `\n- ${a.type}${a.subject ? `: ${a.subject}` : ""} (${new Date(a.createdAt).toLocaleDateString()})`;
    }
  }

  const toneGuide: Record<EmailTone, string> = {
    professional: "Formal, polished, and business-appropriate. Confident without being stiff.",
    friendly: "Warm, approachable, and conversational. Like writing to a colleague you respect.",
    urgent: "Direct and time-sensitive. Create a sense of importance without being pushy.",
    consultative: "Advisory and value-driven. Position as a trusted expert offering insights.",
  };

  const purposeGuide: Record<EmailPurpose, string> = {
    follow_up: "Follow up on a previous conversation or interaction. Reference specifics if available.",
    introduction: "First outreach to introduce yourself and your value proposition. Be concise and compelling.",
    proposal: "Present or reference a business proposal. Highlight value and next steps.",
    meeting_request: "Request a meeting or call. Provide clear value for their time and suggest specific times.",
    objection_handling: "Address a concern or objection. Be empathetic, provide evidence, and reframe value.",
    check_in: "Casual check-in to maintain the relationship. Add value, don't just ask for updates.",
    thank_you: "Express genuine gratitude. Be specific about what you're thankful for and hint at next steps.",
  };

  return `Generate a personalized sales email. Return valid JSON with "subject" and "body" keys only.

Recipient: ${contactName}
Sender: ${senderName}
Purpose: ${PURPOSE_LABELS[purpose]} - ${purposeGuide[purpose]}
Tone: ${tone} - ${toneGuide[tone]}
Language: ${language === "en" ? "English" : language}
${additionalContext ? `\nAdditional Context from Sender: ${additionalContext}` : ""}
${contextBlock}

Requirements:
- Subject line: concise, compelling, under 60 chars. No generic subjects.
- Body: 3-6 short paragraphs. Personalize with CRM data when available.
- Include a clear call-to-action.
- Sign off with "${senderName}" (no title/company — they'll add that).
- Do NOT use placeholder brackets like [Company] or [Product].
- If no CRM context is available, write a strong generic email for the purpose.

Return exactly: {"subject": "...", "body": "..."}`;
}

// ── Deterministic Fallback Templates ────────────────────────────────────

function generateDeterministicEmail(params: {
  contactName: string;
  contactEmail?: string;
  purpose: EmailPurpose;
  tone: EmailTone;
  additionalContext?: string;
  crmContext: CRMContext;
  senderName: string;
}): { subject: string; body: string } {
  const { contactName, purpose, tone, crmContext, senderName } = params;
  const firstName = contactName.split(" ")[0];
  const companyName = crmContext.lead?.companyName || "your company";
  const dealTitle = crmContext.opportunity?.title || "";

  const greeting = tone === "friendly" ? `Hi ${firstName},` : tone === "urgent" ? `${firstName},` : `Dear ${firstName},`;
  const signoff = tone === "friendly" ? `Cheers,\n${senderName}` : tone === "urgent" ? `Best,\n${senderName}` : `Best regards,\n${senderName}`;

  const templates: Record<EmailPurpose, { subject: string; body: string }> = {
    follow_up: {
      subject: `Following up on our conversation${dealTitle ? ` about ${dealTitle}` : ""}`,
      body: `${greeting}

I wanted to follow up on our recent conversation${dealTitle ? ` regarding ${dealTitle}` : ""}. I hope you've had a chance to review the information we discussed.

${crmContext.opportunity ? `As we talked about, this could bring significant value to ${companyName}, and I want to make sure we keep the momentum going.` : `I believe there's a great opportunity for us to work together, and I'd love to continue our discussion.`}

Would you have 15 minutes this week for a quick call to discuss next steps?

${signoff}`,
    },

    introduction: {
      subject: `Helping ${companyName} achieve better results`,
      body: `${greeting}

${crmContext.lead?.title ? `As ${crmContext.lead.title} at ${companyName}` : `At ${companyName}`}, I imagine you're always looking for ways to drive better outcomes for your team.

I'm reaching out because we've been helping companies ${crmContext.lead?.companyIndustry ? `in the ${crmContext.lead.companyIndustry} space ` : ""}streamline their operations and achieve measurable growth.

I'd love to share a few ideas that could be relevant to your goals. Would you be open to a brief 15-minute conversation this week?

${signoff}`,
    },

    proposal: {
      subject: `Proposal for ${companyName}${dealTitle ? `: ${dealTitle}` : ""}`,
      body: `${greeting}

Thank you for your time and the great discussion we've had so far. Based on our conversations, I've put together a proposal that I believe aligns well with your objectives${crmContext.opportunity ? ` for ${dealTitle}` : ""}.

${crmContext.opportunity ? `The proposed solution is valued at $${crmContext.opportunity.value.toLocaleString()} and is designed to deliver measurable ROI for ${companyName}.` : `The proposal is designed to address the key challenges we discussed and deliver measurable results for ${companyName}.`}

I'd love to walk you through the details and answer any questions. When would be a good time to connect?

${signoff}`,
    },

    meeting_request: {
      subject: `Quick call to discuss ${dealTitle || `opportunities for ${companyName}`}`,
      body: `${greeting}

I'd like to schedule a brief meeting to discuss ${dealTitle ? `the progress on ${dealTitle}` : `how we can support ${companyName}'s goals`}.

I have a few ideas I think you'll find valuable, and it should only take about 20-30 minutes of your time.

Would any of the following work for you?
- Tomorrow at 10:00 AM or 2:00 PM
- Thursday at 11:00 AM or 3:00 PM

Feel free to suggest a time that works better for your schedule.

${signoff}`,
    },

    objection_handling: {
      subject: `Addressing your concerns${dealTitle ? ` about ${dealTitle}` : ""}`,
      body: `${greeting}

I appreciate you sharing your thoughts with me — it shows you're seriously evaluating this, and I want to make sure we address every concern thoroughly.

I understand where you're coming from, and I've seen similar questions from other ${crmContext.lead?.companyIndustry ? `${crmContext.lead.companyIndustry} ` : ""}leaders. What we've found is that the value becomes clear once we look at the long-term impact and ROI.

I'd love to schedule a quick call to walk through the specifics and share some relevant case studies. Would you have 15 minutes this week?

${signoff}`,
    },

    check_in: {
      subject: `Checking in, ${firstName}`,
      body: `${greeting}

I hope you're doing well! I wanted to check in and see how things are going${crmContext.opportunity ? ` with ${dealTitle}` : ` at ${companyName}`}.

${crmContext.lead?.lastContact ? `It's been a little while since we last connected, and I wanted to make sure you have everything you need.` : `I came across some insights that I thought might be relevant to your work and wanted to share them with you.`}

No rush on a response — just wanted to stay in touch and see if there's anything I can help with.

${signoff}`,
    },

    thank_you: {
      subject: `Thank you, ${firstName}!`,
      body: `${greeting}

I just wanted to take a moment to sincerely thank you for ${crmContext.opportunity ? `moving forward with ${dealTitle}` : `your time and consideration`}.

It's been a pleasure working with you, and I'm excited about what we can accomplish together${crmContext.lead?.companyName ? ` at ${companyName}` : ""}.

Please don't hesitate to reach out if you need anything at all. I'm always here to help.

${signoff}`,
    },
  };

  return templates[purpose];
}
