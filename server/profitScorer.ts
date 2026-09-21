import type { ProfitOpportunity, ProfitScore } from "../shared/intelligenceFabric";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function scoreProfitOpportunity(opportunity: ProfitOpportunity): ProfitScore {
  const probability = clamp01(opportunity.probability);
  const risk = clamp01(opportunity.risk);
  const strategicFit = clamp01(opportunity.strategicFit);
  const hours = Math.max(0.5, opportunity.estimatedHours);
  const revenue = Math.max(0, opportunity.revenuePotential);
  const cost = Math.max(0, opportunity.directCost);

  const expectedValue = revenue * probability - cost;
  const effortAdjustedValue = expectedValue / hours;

  const valueSignal = Math.tanh(Math.max(0, effortAdjustedValue) / 5000);
  const riskPenalty = 1 - risk * 0.55;
  const fitBoost = 0.7 + strategicFit * 0.3;
  const score = Math.round(clamp01(valueSignal * riskPenalty * fitBoost) * 100);

  const reasons = [
    `Expected value: ${Math.round(expectedValue)}`,
    `Effort-adjusted value: ${Math.round(effortAdjustedValue)} per hour`,
    `Risk: ${Math.round(risk * 100)}%`,
    `Strategic fit: ${Math.round(strategicFit * 100)}%`,
  ];

  return { score, expectedValue, effortAdjustedValue, reasons };
}
