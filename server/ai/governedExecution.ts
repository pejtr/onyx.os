import type {
  GateEvaluation,
  GovernedAction,
} from "../../shared/aiFabric";

export interface ExecutionPolicy {
  allowAutoRead: boolean;
  allowDestructiveWithHumanGate: boolean;
}

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  allowAutoRead: true,
  allowDestructiveWithHumanGate: false,
};

export function evaluateGovernedAction(
  action: GovernedAction,
  policy: ExecutionPolicy = DEFAULT_EXECUTION_POLICY
): GateEvaluation {
  if (!action.targetVerified) {
    return {
      decision: "DENY",
      reasons: ["target_unverified"],
    };
  }

  switch (action.risk) {
    case "READ":
      return policy.allowAutoRead
        ? { decision: "AUTO", reasons: ["verified_read_only"] }
        : { decision: "HUMAN_GATE", reasons: ["read_requires_review"] };

    case "EXTERNAL_WRITE":
      return {
        decision: "HUMAN_GATE",
        reasons: ["external_write_requires_human_gate"],
      };

    case "FINANCIAL":
      return {
        decision: "HUMAN_GATE",
        reasons: ["financial_action_requires_human_gate"],
      };

    case "DESTRUCTIVE":
      return policy.allowDestructiveWithHumanGate
        ? {
            decision: "HUMAN_GATE",
            reasons: ["destructive_action_explicitly_gateable"],
          }
        : {
            decision: "DENY",
            reasons: ["destructive_action_disabled_by_default"],
          };
  }
}
