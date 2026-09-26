# ONYX Agent Containment v1

This policy treats evaluation and training environments as real security boundaries, not as trusted sandboxes.

## Default rules

1. **Egress is deny-by-default.** An agent may reach an external host only when the action explicitly declares network egress and the destination is present in `ONYX_AGENT_EGRESS_ALLOWLIST`.
2. **Evaluation is production-grade.** Eval workloads cannot combine internet egress with shared or admin credentials.
3. **Method matters, not only outcome.** A policy-violating method is denied even when the requested result is correct.
4. **Agent claims are not evidence.** Mutating actions backed only by unverified tool output require a human gate.
5. **Shared/admin credentials are exceptional.** Mutating actions using them require explicit approval.
6. **Unknowns fail closed.** Missing destination data on an egress action is denied.
7. **Human gate remains mandatory** for external writes, financial operations and destructive actions.

## Tool evidence

Trusted wrappers can HMAC-sign canonical tool output with `signToolEvidence()`; consumers verify it with `verifyToolEvidence()`.
The signing key must live outside model-visible context.

## Deployment

Set `ONYX_AGENT_EGRESS_ALLOWLIST` as a comma-separated list of explicit hosts, for example:

```
api.github.com,api.cloudflare.com
```

Do not use wildcard `*`. Add hosts only when a concrete workflow needs them.

## Next enforcement layer

- short-lived per-agent credentials
- outbound proxy with DNS/host policy enforcement
- immutable audit events for every denied/human-gated action
- severe-alert circuit breaker with automatic workload pause
- separate security trust plane with no write access from ordinary agents
