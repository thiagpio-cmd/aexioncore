import { describe, it, expect } from "vitest";
import {
  LEAD_STATUS,
  LEAD_STATUS_TRANSITIONS,
  OPP_STAGE,
  OPP_STAGE_TRANSITIONS,
  STAGE_DEFAULT_PROBABILITY,
  TASK_STATUS,
} from "@/lib/domain/enums";

describe("Lead Status Transitions", () => {
  it("NEW can transition to CONTACTED or DISQUALIFIED", () => {
    expect(LEAD_STATUS_TRANSITIONS.NEW).toEqual(["CONTACTED", "DISQUALIFIED"]);
  });

  it("CONTACTED can transition to QUALIFIED or DISQUALIFIED", () => {
    expect(LEAD_STATUS_TRANSITIONS.CONTACTED).toContain("QUALIFIED");
    expect(LEAD_STATUS_TRANSITIONS.CONTACTED).toContain("DISQUALIFIED");
  });

  it("CONVERTED is terminal (no transitions)", () => {
    expect(LEAD_STATUS_TRANSITIONS.CONVERTED).toEqual([]);
  });

  it("DISQUALIFIED can be re-activated to NEW", () => {
    expect(LEAD_STATUS_TRANSITIONS.DISQUALIFIED).toContain("NEW");
  });

  it("cannot go from NEW directly to QUALIFIED", () => {
    expect(LEAD_STATUS_TRANSITIONS.NEW).not.toContain("QUALIFIED");
  });

  it("cannot go from NEW directly to CONVERTED", () => {
    expect(LEAD_STATUS_TRANSITIONS.NEW).not.toContain("CONVERTED");
  });
});

describe("Opportunity Stage Transitions", () => {
  it("DISCOVERY can advance to QUALIFICATION or close lost", () => {
    expect(OPP_STAGE_TRANSITIONS.DISCOVERY).toContain("QUALIFICATION");
    expect(OPP_STAGE_TRANSITIONS.DISCOVERY).toContain("CLOSED_LOST");
  });

  it("cannot skip from DISCOVERY to CLOSED_WON", () => {
    expect(OPP_STAGE_TRANSITIONS.DISCOVERY).not.toContain("CLOSED_WON");
  });

  it("cannot skip from DISCOVERY to NEGOTIATION", () => {
    expect(OPP_STAGE_TRANSITIONS.DISCOVERY).not.toContain("NEGOTIATION");
  });

  it("NEGOTIATION can close won or lost", () => {
    expect(OPP_STAGE_TRANSITIONS.NEGOTIATION).toContain("CLOSED_WON");
    expect(OPP_STAGE_TRANSITIONS.NEGOTIATION).toContain("CLOSED_LOST");
  });

  it("CLOSED_WON is terminal", () => {
    expect(OPP_STAGE_TRANSITIONS.CLOSED_WON).toEqual([]);
  });

  it("CLOSED_LOST can be re-opened to DISCOVERY", () => {
    expect(OPP_STAGE_TRANSITIONS.CLOSED_LOST).toContain("DISCOVERY");
  });

  it("can go backwards: PROPOSAL to QUALIFICATION", () => {
    expect(OPP_STAGE_TRANSITIONS.PROPOSAL).toContain("QUALIFICATION");
  });
});

describe("Stage Default Probability", () => {
  it("DISCOVERY has 15% probability", () => {
    expect(STAGE_DEFAULT_PROBABILITY.DISCOVERY).toBe(15);
  });

  it("CLOSED_WON has 100% probability", () => {
    expect(STAGE_DEFAULT_PROBABILITY.CLOSED_WON).toBe(100);
  });

  it("CLOSED_LOST has 0% probability", () => {
    expect(STAGE_DEFAULT_PROBABILITY.CLOSED_LOST).toBe(0);
  });

  it("probability increases with stage advancement", () => {
    const stages = ["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION"] as const;
    for (let i = 0; i < stages.length - 1; i++) {
      expect(STAGE_DEFAULT_PROBABILITY[stages[i]]).toBeLessThan(
        STAGE_DEFAULT_PROBABILITY[stages[i + 1]]
      );
    }
  });
});

describe("Enum Completeness", () => {
  it("Lead status has 5 values", () => {
    expect(Object.keys(LEAD_STATUS)).toHaveLength(5);
  });

  it("Opportunity stage has 6 values", () => {
    expect(Object.keys(OPP_STAGE)).toHaveLength(6);
  });

  it("Task status has 4 values", () => {
    expect(Object.keys(TASK_STATUS)).toHaveLength(4);
  });

  it("every lead status has transition rules defined", () => {
    for (const status of Object.values(LEAD_STATUS)) {
      expect(LEAD_STATUS_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("every opp stage has transition rules defined", () => {
    for (const stage of Object.values(OPP_STAGE)) {
      expect(OPP_STAGE_TRANSITIONS).toHaveProperty(stage);
    }
  });

  it("every opp stage has default probability defined", () => {
    for (const stage of Object.values(OPP_STAGE)) {
      expect(STAGE_DEFAULT_PROBABILITY).toHaveProperty(stage);
    }
  });
});
