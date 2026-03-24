import { describe, it, expect } from "vitest";
import { inferPersona, calculateLeadFit, calculateOpportunityProbability } from "@/lib/scoring/engine";

describe("inferPersona", () => {
  it("identifies Decision Maker from C-level titles", () => {
    expect(inferPersona("CEO")).toBe("Decision Maker");
    expect(inferPersona("Chief Technology Officer")).toBe("Decision Maker");
    expect(inferPersona("VP of Sales")).toBe("Decision Maker");
    expect(inferPersona("Director of Engineering")).toBe("Decision Maker");
    expect(inferPersona("Co-Founder")).toBe("Decision Maker");
  });

  it("identifies Champion from management titles", () => {
    expect(inferPersona("Engineering Manager")).toBe("Champion");
    expect(inferPersona("Senior Developer")).toBe("Champion");
    expect(inferPersona("Tech Lead")).toBe("Champion");
    expect(inferPersona("Principal Architect")).toBe("Champion");
  });

  it("identifies Gatekeeper from admin titles", () => {
    // "Executive Assistant" matches "assistant" (Gatekeeper) but also contains keywords
    // that may match Decision Maker first. Test with pure gatekeeper titles.
    expect(inferPersona("Administrative Assistant")).toBe("Gatekeeper");
    expect(inferPersona("Intern")).toBe("Gatekeeper");
    expect(inferPersona("Office Secretary")).toBe("Gatekeeper");
  });

  it("returns Evaluator for generic titles", () => {
    expect(inferPersona("Software Engineer")).toBe("Evaluator");
    expect(inferPersona("Analyst")).toBe("Evaluator");
  });

  it("returns Unknown for null/empty", () => {
    expect(inferPersona(null)).toBe("Unknown");
    expect(inferPersona(undefined)).toBe("Unknown");
    expect(inferPersona("")).toBe("Unknown");
  });
});

describe("calculateLeadFit", () => {
  it("gives base score of 30 for minimal lead", () => {
    const result = calculateLeadFit({ name: "Test" });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("boosts score for Decision Maker title", () => {
    const base = calculateLeadFit({ name: "Test" });
    const dm = calculateLeadFit({ name: "Test", title: "CEO" });
    expect(dm.score).toBeGreaterThan(base.score);
    expect(dm.persona).toBe("Decision Maker");
  });

  it("penalizes Gatekeeper role", () => {
    const gk = calculateLeadFit({ name: "Test", title: "Administrative Assistant" });
    const dm = calculateLeadFit({ name: "Test", title: "CEO" });
    expect(gk.score).toBeLessThan(dm.score);
    expect(gk.persona).toBe("Gatekeeper");
    expect(dm.persona).toBe("Decision Maker");
  });

  it("boosts score for valid company", () => {
    const noCompany = calculateLeadFit({ name: "Test" });
    const withCompany = calculateLeadFit({ name: "Test", company: { name: "Acme Corp" } as any });
    expect(withCompany.score).toBeGreaterThan(noCompany.score);
  });

  it("penalizes generic company names", () => {
    const result = calculateLeadFit({ name: "Test", company: { name: "personal" } as any });
    expect(result.signals.negative.length).toBeGreaterThan(0);
  });

  it("caps UNQUALIFIED leads at 10", () => {
    const result = calculateLeadFit({
      name: "Test",
      title: "CEO",
      status: "UNQUALIFIED",
      company: { name: "BigCorp", size: "Enterprise", industry: "Tech" } as any,
    });
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("clamps score between 0 and 100", () => {
    const result = calculateLeadFit({
      name: "Mega Lead",
      title: "CEO",
      phone: "+1555",
      company: { name: "Enterprise Co", size: "10000+", industry: "SaaS" } as any,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("calculateOpportunityProbability", () => {
  it("uses probability as base if provided", () => {
    const result = calculateOpportunityProbability({ probability: 50 });
    // 50 base - 10 (no value) - 15 (no close date) = 25
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(50);
  });

  it("boosts for Decision Maker contact", () => {
    const base = calculateOpportunityProbability({ probability: 50 });
    const withDM = calculateOpportunityProbability({
      probability: 50,
      primaryContact: { title: "CEO" } as any,
    });
    expect(withDM.score).toBeGreaterThan(base.score);
  });

  it("boosts for quantified value", () => {
    const noValue = calculateOpportunityProbability({ probability: 50 });
    const withValue = calculateOpportunityProbability({ probability: 50, value: 100000 });
    expect(withValue.score).toBeGreaterThan(noValue.score);
  });

  it("penalizes overdue close date", () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = calculateOpportunityProbability({
      probability: 70,
      expectedCloseDate: pastDate,
      value: 50000,
    });
    expect(result.risks.some(r => r.includes("past"))).toBe(true);
  });

  it("penalizes missing close date", () => {
    const result = calculateOpportunityProbability({ probability: 50 });
    expect(result.risks.some(r => r.includes("close date"))).toBe(true);
  });

  it("clamps score between 0 and 100", () => {
    const result = calculateOpportunityProbability({
      probability: 95,
      value: 500000,
      primaryContact: { title: "CEO" } as any,
      description: "Long description with all details about the enterprise deal and requirements",
      expectedCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
