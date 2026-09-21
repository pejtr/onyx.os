import type {
  GovernedAction,
  GovernedActionDecision,
} from "../shared/intelligenceFabric";

export function decideGovernedAction(action: GovernedAction): GovernedActionDecision {
  switch (action.risk) {
    case "read":
    case "draft":
      return {
        decision: "allow",
        reason: "Read-only and draft actions do not mutate external state.",
      };

    case "internal_write":
      return action.reversible
        ? {
            decision: "allow",
            reason: "Reversible internal write is allowed by default policy.",
          }
        : {
            decision: "human_gate",
            reason: "Irreversible internal writes require explicit approval.",
          };

    case "external_write":
      return {
        decision: "human_gate",
        reason: "External mutations require explicit human approval.",
      };

    case "financial":
      return {
        decision: "human_gate",
        reason: "Financial actions always require explicit human approval.",
      };

    case "destructive":
      return {
        decision: "human_gate",
        reason: "Destructive actions require explicit human approval.",
      };

    default:
      return {
        decision: "deny",
        reason: "Unknown risk class is denied fail-closed.",
      };
  }
}
