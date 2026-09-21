import { afterEach, describe, expect, it } from "vitest";
import { resolveModelPlan } from "./modelRouter";
import { rankKnowledgeChunks, buildKnowledgeContext } from "./knowledgeFabric";
import { decideGovernedAction } from "./governedExecution";
import { scoreProfitOpportunity } from "./profitScorer";
import type { KnowledgeChunk } from "../shared/intelligenceFabric";

const ENV_KEYS = ["ONYX_MODEL_FAST", "ONYX_MODEL_EXPERT", "ONYX_MODEL_PARALLEL"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = originalEnv[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe("ONYX Model Router", () => {
  it("keeps the current fast model as the safe default", () => {
    delete process.env.ONYX_MODEL_FAST;
    const plan = resolveModelPlan();
    expect(plan.mode).toBe("fast");
    expect(plan.primaryModel).toBe("gemini-2.5-flash");
    expect(plan.candidateModels).toEqual(["gemini-2.5-flash"]);
  });

  it("uses configured expert and parallel models without duplicates", () => {
    process.env.ONYX_MODEL_FAST = "fast-model";
    process.env.ONYX_MODEL_EXPERT = "expert-model";
    process.env.ONYX_MODEL_PARALLEL = "expert-model,fast-model,expert-model";

    expect(resolveModelPlan({ mode: "expert" }).primaryModel).toBe("expert-model");
    expect(resolveModelPlan({ mode: "parallel" }).candidateModels).toEqual([
      "expert-model",
      "fast-model",
    ]);
  });
});

describe("ONYX Knowledge Fabric", () => {
  const chunks: KnowledgeChunk[] = [
    {
      chunkId: "paygate-1",
      source: {
        sourceId: "github:optimateo",
        kind: "github",
        title: "Paygate architecture",
      },
      text: "Produkční platební brána používá fail closed gate a vyžaduje explicitní potvrzení.",
    },
    {
      chunkId: "travel-1",
      source: {
        sourceId: "notion:travel",
        kind: "notion",
        title: "Travel roadmap",
      },
      text: "Travel roadmap popisuje affiliate feed a SEO landing pages.",
    },
  ];

  it("returns relevant chunks and preserves provenance", () => {
    const hits = rankKnowledgeChunks("platební brána fail closed", chunks);
    expect(hits).toHaveLength(1);
    expect(hits[0].chunk.chunkId).toBe("paygate-1");
    expect(hits[0].chunk.source.sourceId).toBe("github:optimateo");

    const context = buildKnowledgeContext(hits);
    expect(context).toContain("sourceId=github:optimateo");
    expect(context).toContain("chunkId=paygate-1");
  });
});

describe("ONYX governed execution", () => {
  it("allows read/draft but gates external and financial mutations", () => {
    expect(
      decideGovernedAction({
        action: "read_repo",
        risk: "read",
        description: "Read repository state",
      }).decision
    ).toBe("allow");

    expect(
      decideGovernedAction({
        action: "send_email",
        risk: "external_write",
        description: "Send outbound email",
      }).decision
    ).toBe("human_gate");

    expect(
      decideGovernedAction({
        action: "charge_card",
        risk: "financial",
        description: "Create payment",
      }).decision
    ).toBe("human_gate");
  });
});

describe("OMNI PROFIT scorer", () => {
  it("ranks a high-value low-risk opportunity above a weak one", () => {
    const strong = scoreProfitOpportunity({
      id: "strong",
      revenuePotential: 100_000,
      probability: 0.8,
      estimatedHours: 8,
      directCost: 5_000,
      risk: 0.15,
      strategicFit: 0.9,
    });

    const weak = scoreProfitOpportunity({
      id: "weak",
      revenuePotential: 10_000,
      probability: 0.2,
      estimatedHours: 20,
      directCost: 4_000,
      risk: 0.7,
      strategicFit: 0.3,
    });

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.expectedValue).toBeGreaterThan(weak.expectedValue);
  });
});
