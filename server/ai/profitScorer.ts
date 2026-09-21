import type {
  ProfitOpportunity,
  ProfitScore,
} from "../../shared/aiFabric";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function scoreProfitOpportunity(
  opportunity: ProfitOpportunity
): ProfitScore {
  const probability = clamp01(opportunity.probability);
  const margin = clamp01(opportunity.grossMargin);
  const risk = clamp01(opportunity.risk);
  const hours = Math.max(0.5, opportunity.hoursRequired);
  const cashCost = Math.max(0, opportunity.cashCost);
  const days = Math.max(0, opportunity.timeToRevenueDays);

  const expectedGrossProfit =
    opportunity.expectedRevenue * probability * margin - cashCost;
  const speedFactor = 1 / (1 + days / 30);
  const riskFactor = 1 - risk;

  const priorityIndex =
    (expectedGrossProfit * speedFactor * riskFactor) / hours;

  return {
    opportunityId: opportunity.id,
    expectedGrossProfit,
    speedFactor,
    riskFactor,
    priorityIndex,
    currency: opportunity.currency ?? "CZK",
  };
}

export function rankProfitOpportunities(
  opportunities: ProfitOpportunity[]
): ProfitScore[] {
  return opportunities
    .map(scoreProfitOpportunity)
    .sort(
      (a, b) =>
        b.priorityIndex - a.priorityIndex ||
        a.opportunityId.localeCompare(b.opportunityId)
    );
}
