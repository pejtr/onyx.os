import type {
  GovernedAction,
  GovernedActionDecision,
} from "../shared/intelligenceFabric";
import { isEgressAllowed } from "./agentContainment";

export function decideGovernedAction(action: GovernedAction): GovernedActionDecision {
  if (action.methodCompliance === "violated") {
    return {
      decision: "deny",
      reason: "Action method violated policy; outcome alone cannot authorize execution.",
    };
  }

  if (action.networkEgress) {
    if (!action.destinationHost) {
      return {
        decision: "deny",
        reason: "Network egress without an explicit destination host is denied fail-closed.",
      };
    }

    if (!isEgressAllowed(action.destinationHost)) {
      return {
        decision: "deny",
        reason: `Outbound host '${action.destinationHost}' is not on the agent egress allowlist.`,
      };
    }
  }

  if (
    action.environment === "eval" &&
    action.networkEgress &&
    (action.credentialScope === "shared" || action.credentialScope === "admin")
  ) {
    return {
      decision: "deny",
      reason: "Evaluation workloads may not combine internet egress with shared/admin credentials.",
    };
  }

  if (
    action.toolEvidence &&
    !action.toolEvidence.verified &&
    action.risk !== "read" &&
    action.risk !== "draft"
  ) {
    return {
      decision: "human_gate",
      reason: "Mutating actions require verified tool evidence; agent-claimed output is not authoritative.",
    };
  }

  if (
    action.credentialAccess &&
    (action.credentialScope === "shared" || action.credentialScope === "admin") &&
    action.risk !== "read"
  ) {
    return {
      decision: "human_gate",
      reason: "Shared/admin credential use on mutating actions requires explicit approval.",
    };
  }

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
