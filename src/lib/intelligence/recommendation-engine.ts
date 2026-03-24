import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecommendationType =
  | "FOLLOW_UP"
  | "SCHEDULE_MEETING"
  | "CONVERT_LEAD"
  | "MOVE_STAGE"
  | "APPLY_PLAYBOOK"
  | "REASSIGN_OWNER"
  | "CREATE_TASK"
  | "ESCALATE"
  | "SEND_EMAIL"
  | "UPDATE_FORECAST"
  | "REVIEW_DEAL"
  | "BOOK_DEMO";

export interface Recommendation {
  id: string;
  type: RecommendationType;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  reasoning: string;
  entityType: string;
  entityId: string;
  entityName: string;
  confidence: number; // 0-1
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  actionLabel: string;
  actionUrl: string;
  suggestedDueDate?: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// RecommendationEngine
// ---------------------------------------------------------------------------

export class RecommendationEngine {
  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async generateRecommendations(
    organizationId: string,
    options?: {
      entityType?: string;
      entityId?: string;
      ownerId?: string;
      limit?: number;
    }
  ): Promise<Recommendation[]> {
    const limit = options?.limit ?? 20;
    const recommendations: Recommendation[] = [];

    // If a specific entity is requested, scope to that
    if (options?.entityType === "lead" && options?.entityId) {
      const lead = await prisma.lead.findUnique({
        where: { id: options.entityId },
        include: {
          owner: { select: { id: true, name: true } },
          company: { select: { name: true } },
          meetings: { select: { id: true, startTime: true }, orderBy: { startTime: "desc" }, take: 1 },
        },
      });
      if (lead) {
        recommendations.push(...(await this.forLead(lead)));
      }
      return recommendations.slice(0, limit);
    }

    if (options?.entityType === "opportunity" && options?.entityId) {
      const opp = await prisma.opportunity.findUnique({
        where: { id: options.entityId },
        include: {
          owner: { select: { id: true, name: true } },
          account: { select: { name: true } },
          tasks: { where: { status: { not: "COMPLETED" } }, take: 5 },
        },
      });
      if (opp) {
        recommendations.push(...(await this.forOpportunity(opp)));
      }
      return recommendations.slice(0, limit);
    }

    // Otherwise, generate recommendations across the org
    const checks: Array<Promise<Recommendation[]>> = [
      this.recommendConvertHotLeads(organizationId, options?.ownerId),
      this.recommendMoveStuckDeals(organizationId, options?.ownerId),
      this.recommendCreateNextStep(organizationId, options?.ownerId),
      this.recommendHighFitLeads(organizationId, options?.ownerId),
      this.recommendScheduleMeetings(organizationId, options?.ownerId),
      this.recommendReviewHighValue(organizationId, options?.ownerId),
      this.recommendFollowUpStaleLeads(organizationId, options?.ownerId),
    ];

    const results = await Promise.all(checks);
    for (const batch of results) {
      recommendations.push(...batch);
    }

    // Sort by priority then by confidence
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });

    return recommendations.slice(0, limit);
  }

  // -------------------------------------------------------------------------
  // Entity-scoped recommendation generators
  // -------------------------------------------------------------------------

  async forLead(lead: {
    id: string;
    name: string;
    status: string;
    temperature: string;
    fitScore: number;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    lastContact: Date | null;
    owner?: { id: string; name: string } | null;
    company?: { name: string } | null;
    meetings?: Array<{ id: string; startTime: Date }>;
  }): Promise<Recommendation[]> {
    const recs: Recommendation[] = [];
    const age = daysSince(lead.createdAt);
    const lastActivity = daysSince(lead.updatedAt);

    // HOT lead not converted > 3 days
    if (lead.temperature === "HOT" && !["CONVERTED", "LOST", "DISQUALIFIED"].includes(lead.status) && age > 3) {
      recs.push({
        id: `rec-convert-${lead.id}`,
        type: "CONVERT_LEAD",
        priority: "high",
        title: `Convert HOT lead "${lead.name}"`,
        description: `This HOT lead has been open for ${age} days. Consider converting to an opportunity.`,
        reasoning: `Temperature is HOT, status is ${lead.status}, age is ${age} days. HOT leads should convert quickly.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        confidence: 0.85,
        impact: "high",
        effort: "low",
        actionLabel: "Convert to opportunity",
        actionUrl: `/leads/${lead.id}`,
        suggestedDueDate: addDays(1),
      });
    }

    // High fitScore lead — prioritize
    if (lead.fitScore >= 80 && !["CONVERTED", "LOST", "DISQUALIFIED"].includes(lead.status)) {
      recs.push({
        id: `rec-prioritize-${lead.id}`,
        type: "FOLLOW_UP",
        priority: "high",
        title: `Prioritize high-fit lead "${lead.name}"`,
        description: `This lead has a fit score of ${lead.fitScore}. It matches your ideal customer profile.`,
        reasoning: `Fit score (${lead.fitScore}) is above 80, indicating strong ICP alignment.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        confidence: 0.9,
        impact: "high",
        effort: "low",
        actionLabel: "Follow up now",
        actionUrl: `/leads/${lead.id}`,
        suggestedDueDate: addDays(1),
      });
    }

    // Lead with no meetings — book demo
    if (
      (!lead.meetings || lead.meetings.length === 0) &&
      lead.temperature !== "COLD" &&
      !["CONVERTED", "LOST", "DISQUALIFIED"].includes(lead.status)
    ) {
      recs.push({
        id: `rec-book-demo-${lead.id}`,
        type: "BOOK_DEMO",
        priority: "medium",
        title: `Book a demo for "${lead.name}"`,
        description: `This ${lead.temperature} lead has no meetings scheduled. A demo could accelerate conversion.`,
        reasoning: `No meetings found. Temperature is ${lead.temperature}. Demos increase conversion by 3x on average.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        confidence: 0.7,
        impact: "medium",
        effort: "medium",
        actionLabel: "Schedule demo",
        actionUrl: `/leads/${lead.id}`,
        suggestedDueDate: addDays(3),
      });
    }

    // Stale lead — follow up
    if (lastActivity > 5 && !["CONVERTED", "LOST", "DISQUALIFIED"].includes(lead.status)) {
      recs.push({
        id: `rec-followup-${lead.id}`,
        type: "FOLLOW_UP",
        priority: lastActivity > 10 ? "high" : "medium",
        title: `Follow up with "${lead.name}"`,
        description: `No activity for ${lastActivity} days. Re-engage before the lead goes cold.`,
        reasoning: `Last update was ${lastActivity} days ago. Leads without activity >5 days have lower conversion rates.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        confidence: 0.75,
        impact: "medium",
        effort: "low",
        actionLabel: "Send follow-up",
        actionUrl: `/leads/${lead.id}`,
        suggestedDueDate: addDays(1),
      });
    }

    return recs;
  }

  async forOpportunity(opp: {
    id: string;
    title: string;
    value: number;
    stage: string;
    probability: number;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    expectedCloseDate: Date | null;
    owner?: { id: string; name: string } | null;
    account?: { name: string } | null;
    tasks?: Array<{ id: string; status: string }>;
  }): Promise<Recommendation[]> {
    const recs: Recommendation[] = [];
    const age = daysSince(opp.createdAt);
    const lastActivity = daysSince(opp.updatedAt);
    const stageLower = opp.stage.toLowerCase();
    const pendingTasks = opp.tasks?.filter((t) => t.status !== "COMPLETED") ?? [];

    // Opportunity in DISCOVERY > 7 days — move to PROPOSAL or schedule meeting
    if (stageLower === "discovery" && lastActivity > 7) {
      recs.push({
        id: `rec-move-stage-${opp.id}`,
        type: "MOVE_STAGE",
        priority: "medium",
        title: `Advance "${opp.title}" from Discovery`,
        description: `This deal has been in Discovery for ${lastActivity} days without progress. Consider moving to Proposal or scheduling a meeting.`,
        reasoning: `Stage is Discovery, last activity ${lastActivity} days ago. Deals lingering in early stages have lower win rates.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        confidence: 0.7,
        impact: "medium",
        effort: "medium",
        actionLabel: "Advance stage",
        actionUrl: `/opportunities/${opp.id}`,
        suggestedDueDate: addDays(2),
      });
    }

    // Deal > $50k without recent activity — schedule executive review
    if (opp.value >= 50000 && lastActivity > 7) {
      recs.push({
        id: `rec-exec-review-${opp.id}`,
        type: "REVIEW_DEAL",
        priority: "high",
        title: `Schedule executive review for "${opp.title}"`,
        description: `$${opp.value.toLocaleString()} deal has had no activity for ${lastActivity} days. An executive review could unblock progress.`,
        reasoning: `High-value deal ($${opp.value.toLocaleString()}) with ${lastActivity} days of inactivity. Escalation is recommended.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        confidence: 0.8,
        impact: "high",
        effort: "medium",
        actionLabel: "Schedule review",
        actionUrl: `/opportunities/${opp.id}`,
        suggestedDueDate: addDays(2),
      });
    }

    // Opportunity without upcoming task — create next step
    if (pendingTasks.length === 0 && !["closed_won", "closed_lost"].includes(stageLower)) {
      recs.push({
        id: `rec-create-task-${opp.id}`,
        type: "CREATE_TASK",
        priority: "high",
        title: `Create next step for "${opp.title}"`,
        description: `This deal has no pending tasks. Define a clear next action to keep momentum.`,
        reasoning: `No incomplete tasks found. Deals without a defined next step are 2x more likely to stall.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        confidence: 0.9,
        impact: "high",
        effort: "low",
        actionLabel: "Add task",
        actionUrl: `/opportunities/${opp.id}`,
        suggestedDueDate: addDays(1),
      });
    }

    // Close date approaching but stage is early
    if (
      opp.expectedCloseDate &&
      opp.expectedCloseDate.getTime() > Date.now() &&
      daysSince(new Date(Date.now() - (opp.expectedCloseDate.getTime() - Date.now()))) < 0
    ) {
      const daysLeft = Math.ceil((opp.expectedCloseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 14 && ["discovery", "qualification"].includes(stageLower)) {
        recs.push({
          id: `rec-escalate-${opp.id}`,
          type: "ESCALATE",
          priority: "high",
          title: `Escalate "${opp.title}" — close date in ${daysLeft} days`,
          description: `The expected close date is in ${daysLeft} days but the deal is still in ${opp.stage}. Urgent action needed.`,
          reasoning: `Close date ${opp.expectedCloseDate.toISOString()}, stage ${opp.stage}. Gap between stage maturity and timeline.`,
          entityType: "opportunity",
          entityId: opp.id,
          entityName: opp.title,
          confidence: 0.85,
          impact: "high",
          effort: "medium",
          actionLabel: "Escalate",
          actionUrl: `/opportunities/${opp.id}`,
          suggestedDueDate: addDays(1),
        });
      }
    }

    // Aging deal
    if (age > 45 && !["closed_won", "closed_lost"].includes(stageLower)) {
      recs.push({
        id: `rec-review-aging-${opp.id}`,
        type: "REVIEW_DEAL",
        priority: "medium",
        title: `Review aging deal "${opp.title}"`,
        description: `This deal has been open for ${age} days. Evaluate if it should be advanced, restructured, or closed.`,
        reasoning: `Deal age is ${age} days. Long sales cycles often indicate qualification issues or stalled negotiations.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        confidence: 0.65,
        impact: "medium",
        effort: "low",
        actionLabel: "Review",
        actionUrl: `/opportunities/${opp.id}`,
      });
    }

    return recs;
  }

  // -------------------------------------------------------------------------
  // Org-wide recommendation generators
  // -------------------------------------------------------------------------

  private async recommendConvertHotLeads(orgId: string, ownerId?: string): Promise<Recommendation[]> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const hotLeads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        temperature: "HOT",
        status: { notIn: ["CONVERTED", "LOST", "DISQUALIFIED"] },
        createdAt: { lt: threeDaysAgo },
      },
      include: { owner: { select: { id: true, name: true } } },
      take: 10,
    });

    return hotLeads.map((lead) => {
      const age = daysSince(lead.createdAt);
      return {
        id: `rec-convert-${lead.id}`,
        type: "CONVERT_LEAD" as RecommendationType,
        priority: "high" as const,
        title: `Convert HOT lead "${lead.name}"`,
        description: `HOT lead open for ${age} days. Convert to opportunity to avoid losing momentum.`,
        reasoning: `Temperature is HOT, created ${age} days ago. HOT leads should convert within 3 days.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        confidence: 0.85,
        impact: "high" as const,
        effort: "low" as const,
        actionLabel: "Convert",
        actionUrl: `/leads/${lead.id}`,
        suggestedDueDate: addDays(1),
      };
    });
  }

  private async recommendMoveStuckDeals(orgId: string, ownerId?: string): Promise<Recommendation[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const stuck = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { in: ["DISCOVERY", "discovery", "QUALIFICATION", "qualification"] },
        updatedAt: { lt: sevenDaysAgo },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      take: 10,
    });

    return stuck.map((opp) => {
      const inactive = daysSince(opp.updatedAt);
      return {
        id: `rec-move-${opp.id}`,
        type: "MOVE_STAGE" as RecommendationType,
        priority: "medium" as const,
        title: `Advance "${opp.title}" from ${opp.stage}`,
        description: `Deal stuck in ${opp.stage} for ${inactive} days. Move forward or schedule a meeting.`,
        reasoning: `Stage ${opp.stage}, ${inactive} days without update. Stalled early-stage deals need attention.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        confidence: 0.7,
        impact: "medium" as const,
        effort: "medium" as const,
        actionLabel: "Advance stage",
        actionUrl: `/opportunities/${opp.id}`,
        suggestedDueDate: addDays(2),
      };
    });
  }

  private async recommendCreateNextStep(orgId: string, ownerId?: string): Promise<Recommendation[]> {
    const deals = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
        tasks: { none: { status: { not: "COMPLETED" } } },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      take: 10,
    });

    return deals.map((opp) => ({
      id: `rec-nextstep-${opp.id}`,
      type: "CREATE_TASK" as RecommendationType,
      priority: "high" as const,
      title: `Create next step for "${opp.title}"`,
      description: `No pending tasks on this deal. Define a clear action to maintain momentum.`,
      reasoning: `Deals without a defined next step are significantly more likely to stall or be lost.`,
      entityType: "opportunity",
      entityId: opp.id,
      entityName: opp.title,
      confidence: 0.9,
      impact: "high" as const,
      effort: "low" as const,
      actionLabel: "Add task",
      actionUrl: `/opportunities/${opp.id}`,
      suggestedDueDate: addDays(1),
    }));
  }

  private async recommendHighFitLeads(orgId: string, ownerId?: string): Promise<Recommendation[]> {
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        fitScore: { gte: 80 },
        status: { notIn: ["CONVERTED", "LOST", "DISQUALIFIED"] },
      },
      include: { owner: { select: { id: true, name: true } } },
      take: 10,
    });

    return leads.map((lead) => ({
      id: `rec-highfit-${lead.id}`,
      type: "FOLLOW_UP" as RecommendationType,
      priority: "high" as const,
      title: `Prioritize high-fit lead "${lead.name}"`,
      description: `Fit score ${lead.fitScore}/100. This lead closely matches your ideal customer profile.`,
      reasoning: `Fit score of ${lead.fitScore} is above the 80-point threshold for high-priority leads.`,
      entityType: "lead",
      entityId: lead.id,
      entityName: lead.name,
      confidence: 0.9,
      impact: "high" as const,
      effort: "low" as const,
      actionLabel: "Follow up",
      actionUrl: `/leads/${lead.id}`,
      suggestedDueDate: addDays(1),
    }));
  }

  private async recommendScheduleMeetings(orgId: string, ownerId?: string): Promise<Recommendation[]> {
    // Warm/Hot leads without meetings
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        temperature: { in: ["WARM", "HOT"] },
        status: { notIn: ["CONVERTED", "LOST", "DISQUALIFIED"] },
        meetings: { none: {} },
      },
      include: { owner: { select: { id: true, name: true } } },
      take: 10,
    });

    return leads.map((lead) => ({
      id: `rec-meeting-${lead.id}`,
      type: "SCHEDULE_MEETING" as RecommendationType,
      priority: (lead.temperature === "HOT" ? "high" : "medium") as "high" | "medium" | "low",
      title: `Schedule meeting with "${lead.name}"`,
      description: `${lead.temperature} lead with no meetings. A call could accelerate qualification.`,
      reasoning: `Lead temperature is ${lead.temperature} but no meetings have been scheduled. Direct engagement is recommended.`,
      entityType: "lead",
      entityId: lead.id,
      entityName: lead.name,
      confidence: 0.75,
      impact: "medium" as const,
      effort: "medium" as const,
      actionLabel: "Schedule",
      actionUrl: `/leads/${lead.id}`,
      suggestedDueDate: addDays(2),
    }));
  }

  private async recommendReviewHighValue(orgId: string, ownerId?: string): Promise<Recommendation[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const deals = await prisma.opportunity.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "closed_won", "closed_lost"] },
        value: { gte: 50000 },
        updatedAt: { lt: sevenDaysAgo },
      },
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { name: true } },
      },
      take: 10,
    });

    return deals.map((opp) => {
      const inactive = daysSince(opp.updatedAt);
      return {
        id: `rec-review-${opp.id}`,
        type: "REVIEW_DEAL" as RecommendationType,
        priority: "high" as const,
        title: `Review $${opp.value.toLocaleString()} deal "${opp.title}"`,
        description: `High-value deal inactive for ${inactive} days. Schedule a review to identify blockers.`,
        reasoning: `Deal value $${opp.value.toLocaleString()}, inactive ${inactive} days. High-value stalled deals need executive attention.`,
        entityType: "opportunity",
        entityId: opp.id,
        entityName: opp.title,
        confidence: 0.8,
        impact: "high" as const,
        effort: "medium" as const,
        actionLabel: "Review",
        actionUrl: `/opportunities/${opp.id}`,
        suggestedDueDate: addDays(2),
      };
    });
  }

  private async recommendFollowUpStaleLeads(orgId: string, ownerId?: string): Promise<Recommendation[]> {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const stale = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        ...(ownerId ? { ownerId } : {}),
        status: { notIn: ["CONVERTED", "LOST", "DISQUALIFIED"] },
        updatedAt: { lt: fiveDaysAgo },
      },
      include: { owner: { select: { id: true, name: true } } },
      take: 10,
    });

    return stale.map((lead) => {
      const inactive = daysSince(lead.updatedAt);
      return {
        id: `rec-followup-${lead.id}`,
        type: "FOLLOW_UP" as RecommendationType,
        priority: (inactive > 10 ? "high" : "medium") as "high" | "medium" | "low",
        title: `Follow up with "${lead.name}"`,
        description: `No activity for ${inactive} days. A quick follow-up can re-engage this lead.`,
        reasoning: `Last update ${inactive} days ago. Engagement drops sharply after 5 days of inactivity.`,
        entityType: "lead",
        entityId: lead.id,
        entityName: lead.name,
        confidence: 0.75,
        impact: "medium" as const,
        effort: "low" as const,
        actionLabel: "Follow up",
        actionUrl: `/leads/${lead.id}`,
        suggestedDueDate: addDays(1),
      };
    });
  }
}
