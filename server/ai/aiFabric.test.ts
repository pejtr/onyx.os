import { describe, expect, it } from "vitest";

import type { KnowledgeChunk, ProfitOpportunity } from "../../shared/aiFabric";
import { evaluateGovernedAction } from "./governedExecution";
import { buildEvidenceContext, rankKnowledgeChunks } from "./knowledgeFabric";
import { resolveModelPlan } from "./modelRouter";
import { rankProfitOpportunities, scoreProfitOpportunity } from "./profitScorer";

const emptyEnv = {
  ONYX_DEFAULT_MODEL: undefined,
  ONYX_FAST_MODEL: undefined,
  ONYX_EXPERT_MODEL: undefined,
  ONYX_SECONDARY_MODEL: undefined,
};

describe("ONYX Model Router", () => {
  it("preserves the current verified default when no routing env is configured", () => {
    const plan = resolveModelPlan("FAST", "classification", emptyEnv);
    expect(plan.primary.model).toBe("gemini-2.5-flash");
    expect(plan.primary.source).toBe("default");
    expect(plan.targets).toHaveLength(1);
  });

  it("inherits an explicitly configured default model into FAST and EXPERT lanes", () => {
    const env = {
      ...emptyEnv,
      ONYX_DEFAULT_MODEL: "configured-primary",
    };

    const fast = resolveModelPlan("FAST", "chat", env);
    const expert = resolveModelPlan("EXPERT", "chat", env);

    expect(fast.primary.model).toBe("configured-primary");
    expect(fast.primary.source).toBe("environment");
    expect(expert.primary.model).toBe("configured-primary");
    expect(expert.primary.source).toBe("environment");
  });

  it("deduplicates PARALLEL lanes and only adds explicit secondary models", () => {
    const plan = resolveModelPlan("PARALLEL", "research", {
      ...emptyEnv,
      ONYX_FAST_MODEL: "fast-model",
      ONYX_EXPERT_MODEL: "expert-model",
      ONYX_SECONDARY_MODEL: "secondary-model",
    });

    expect(plan.targets.map((target) => target.model)).toEqual([
      "expert-model",
      "fast-model",
      "secondary-model",
    ]);
  });
});

describe("ONYX Governed Execution", () => {
  it("auto-approves verified read-only actions", () => {
    expect(
      evaluateGovernedAction({
        id: "read-1",
        risk: "READ",
        description: "Read analytics",
        targetVerified: true,
      }).decision
    ).toBe("AUTO");
  });

  it("denies actions against unverified targets", () => {
    expect(
      evaluateGovernedAction({
        id: "read-2",
        risk: "READ",
        description: "Read unknown endpoint",
        targetVerified: false,
      }).decision
    ).toBe("DENY");
  });

  it("requires a human gate for external writes and financial actions", () => {
    const write = evaluateGovernedAction({
      id: "write-1",
      risk: "EXTERNAL_WRITE",
      description: "Publish a post",
      targetVerified: true,
    });
    const financial = evaluateGovernedAction({
      id: "money-1",
      risk: "FINANCIAL",
      description: "Create a payment",
      targetVerified: true,
    });

    expect(write.decision).toBe("HUMAN_GATE");
    expect(financial.decision).toBe("HUMAN_GATE");
  });

  it("denies destructive actions by default", () => {
    expect(
      evaluateGovernedAction({
        id: "delete-1",
        risk: "DESTRUCTIVE",
        description: "Delete production data",
        targetVerified: true,
      }).decision
    ).toBe("DENY");
  });
});

describe("ONYX Knowledge Fabric", () => {
  const chunks: KnowledgeChunk[] = [
    {
      id: "trusted-revenue",
      text: "Revenue attribution connects campaigns to paid orders and gross profit.",
      trust: "trusted",
      provenance: {
        sourceId: "github:leados",
        sourceKind: "github",
        documentId: "docs/revenue.md",
        chunkId: "c1",
        capturedAt: "2026-09-21T00:00:00Z",
      },
    },
    {
      id: "untrusted-revenue",
      text: "Revenue dashboard tracks campaign revenue.",
      trust: "untrusted",
      provenance: {
        sourceId: "web:example",
        sourceKind: "web",
        documentId: "page-1",
        chunkId: "c2",
        capturedAt: "2026-09-21T00:00:00Z",
      },
    },
    {
      id: "irrelevant",
      text: "Weather forecast for tomorrow.",
      trust: "trusted",
      provenance: {
        sourceId: "manual:misc",
        sourceKind: "manual",
        documentId: "misc",
        chunkId: "c3",
        capturedAt: "2026-09-21T00:00:00Z",
      },
    },
  ];

  it("ranks relevant trusted evidence first and removes irrelevant chunks", () => {
    const ranked = rankKnowledgeChunks("campaign revenue attribution", chunks);
    expect(ranked.map((entry) => entry.chunk.id)).toEqual([
      "trusted-revenue",
      "untrusted-revenue",
    ]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("builds evidence context with explicit provenance boundaries", () => {
    const context = buildEvidenceContext("revenue attribution", chunks);
    expect(context.context).toContain("source=github:leados");
    expect(context.context).toContain("\n");
    expect(context.context).toContain("[/EVIDENCE 1]");
    expect(context.evidence[0].documentId).toBe("docs/revenue.md");
  });
});

describe("OMNI PROFIT scorer", () => {
  const fastHighMargin: ProfitOpportunity = {
    id: "fast-high-margin",
    expectedRevenue: 100_000,
    probability: 0.7,
    grossMargin: 0.8,
    hoursRequired: 10,
    cashCost: 5_000,
    risk: 0.1,
    timeToRevenueDays: 7,
    currency: "CZK",
  };

  const slowLowMargin: ProfitOpportunity = {
    id: "slow-low-margin",
    expectedRevenue: 100_000,
    probability: 0.7,
    grossMargin: 0.4,
    hoursRequired: 30,
    cashCost: 10_000,
    risk: 0.5,
    timeToRevenueDays: 90,
    currency: "CZK",
  };

  it("uses expected profit, speed, risk and required time deterministically", () => {
    const score = scoreProfitOpportunity(fastHighMargin);
    expect(score.expectedGrossProfit).toBe(51_000);
    expect(score.priorityIndex).toBeGreaterThan(0);
  });

  it("ranks faster, safer and higher-margin opportunities above weaker ones", () => {
    const ranked = rankProfitOpportunities([slowLowMargin, fastHighMargin]);
    expect(ranked[0].opportunityId).toBe("fast-high-margin");
  });
});
