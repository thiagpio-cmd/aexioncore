import { describe, it, expect } from "vitest";
import { NativeRuleEngine } from "@/lib/ai/providers/native-rule-engine";

const engine = new NativeRuleEngine();

describe("NativeRuleEngine - Score", () => {
  it("scores a lead with source and title", async () => {
    const result = await engine.score({
      entityType: "lead",
      entityId: "test-1",
      organizationId: "org-1",
      data: { source: "REFERRAL", title: "CEO", temperature: "HOT" },
    });
    expect(result.taskType).toBe("score");
    expect(result.provider).toBe("native-rule-engine");
    expect(Number(result.content)).toBeGreaterThan(50);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("scores an opportunity with stage and value", async () => {
    const result = await engine.score({
      entityType: "opportunity",
      entityId: "opp-1",
      organizationId: "org-1",
      data: { stage: "proposal", value: 75000, probability: 60 },
    });
    expect(Number(result.content)).toBeGreaterThan(20);
    expect(result.structured?.entityType).toBe("opportunity");
  });

  it("clamps scores to 0-100", async () => {
    const result = await engine.score({
      entityType: "lead",
      entityId: "test-2",
      organizationId: "org-1",
      data: { source: "REFERRAL", title: "CEO", temperature: "HOT", fitScore: 20 },
    });
    expect(Number(result.content)).toBeLessThanOrEqual(100);
    expect(Number(result.content)).toBeGreaterThanOrEqual(0);
  });
});

describe("NativeRuleEngine - Recommend", () => {
  it("recommends follow-up for stale lead", async () => {
    const result = await engine.recommend({
      entityType: "lead",
      entityId: "test-3",
      organizationId: "org-1",
      data: {
        lastContact: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        temperature: "WARM",
        status: "CONTACTED",
      },
    });
    expect(result.taskType).toBe("recommend");
    expect(result.structured?.recommendations).toBeDefined();
    const recs = result.structured!.recommendations as any[];
    expect(recs.length).toBeGreaterThan(0);
  });

  it("recommends conversion for HOT unconverted lead", async () => {
    const result = await engine.recommend({
      entityType: "lead",
      entityId: "test-4",
      organizationId: "org-1",
      data: { temperature: "HOT", status: "NEW" },
    });
    const recs = result.structured!.recommendations as any[];
    // HOT + NEW should recommend conversion or contact
    expect(recs.some((r: any) =>
      r.action.toLowerCase().includes("convert") ||
      r.action.toLowerCase().includes("contact") ||
      r.priority === "HIGH"
    )).toBe(true);
  });

  it("recommends meeting for high-value deal", async () => {
    const result = await engine.recommend({
      entityType: "opportunity",
      entityId: "opp-2",
      organizationId: "org-1",
      data: { stage: "qualification", value: 100000, hasMeeting: false },
    });
    const recs = result.structured!.recommendations as any[];
    expect(recs.some((r: any) => r.action.toLowerCase().includes("meeting"))).toBe(true);
  });
});

describe("NativeRuleEngine - Classify", () => {
  it("classifies inquiry text", async () => {
    const result = await engine.classify(
      "I'm wondering about your product features and pricing",
      ["inquiry", "complaint", "support"]
    );
    expect(result.taskType).toBe("classify");
    expect(result.content).toBe("inquiry");
  });

  it("classifies complaint text", async () => {
    const result = await engine.classify(
      "This product is broken and I'm frustrated with the issues",
      ["inquiry", "complaint", "support"]
    );
    expect(result.content).toBe("complaint");
  });

  it("classifies meeting request", async () => {
    const result = await engine.classify(
      "Can we schedule a demo call for next Tuesday?",
      []
    );
    expect(result.content).toBe("meeting-request");
  });
});

describe("NativeRuleEngine - Sentiment", () => {
  it("detects positive sentiment", async () => {
    const result = await engine.analyze({
      entityType: "message",
      entityId: "msg-1",
      organizationId: "org-1",
      data: { text: "Great product, love it, excellent support, amazing team!" },
    });
    expect(result.content).toBe("positive");
    expect(result.structured?.positiveCount).toBeGreaterThan(0);
  });

  it("detects negative sentiment", async () => {
    const result = await engine.analyze({
      entityType: "message",
      entityId: "msg-2",
      organizationId: "org-1",
      data: { text: "Terrible experience, frustrated, broken product, disappointed" },
    });
    expect(result.content).toBe("negative");
  });

  it("detects neutral for bland text", async () => {
    const result = await engine.analyze({
      entityType: "message",
      entityId: "msg-3",
      organizationId: "org-1",
      data: { text: "The meeting is at 3pm on Tuesday in room B" },
    });
    expect(result.content).toBe("neutral");
  });
});

describe("NativeRuleEngine - Extract Entities", () => {
  it("extracts emails", async () => {
    const result = await engine.extractEntities("Contact john@acme.com for details");
    expect(result.structured?.entities?.emails).toContain("john@acme.com");
  });

  it("extracts monetary values", async () => {
    const result = await engine.extractEntities("The deal is worth $50,000 USD");
    expect(result.structured?.entities?.money?.length).toBeGreaterThan(0);
  });

  it("extracts URLs", async () => {
    const result = await engine.extractEntities("Visit https://example.com/demo for more");
    expect(result.structured?.entities?.urls).toContain("https://example.com/demo");
  });
});

describe("NativeRuleEngine - Healthcheck", () => {
  it("always returns healthy", async () => {
    const result = await engine.healthcheck();
    expect(result.healthy).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("NativeRuleEngine - Cost", () => {
  it("always returns zero cost", () => {
    const cost = engine.estimateCost("score", 1000);
    expect(cost.estimatedCost).toBe(0);
    expect(cost.currency).toBe("USD");
  });
});
