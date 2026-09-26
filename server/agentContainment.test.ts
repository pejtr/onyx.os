import { describe, expect, it, vi } from "vitest";
import { decideGovernedAction } from "./governedExecution";
import { signToolEvidence, verifyToolEvidence } from "./agentContainment";

describe("agent containment", () => {
  it("denies undeclared egress", () => {
    expect(decideGovernedAction({
      action: "fetch",
      risk: "read",
      description: "external fetch",
      networkEgress: true,
    }).decision).toBe("deny");
  });

  it("denies non-allowlisted egress", () => {
    vi.stubEnv("ONYX_AGENT_EGRESS_ALLOWLIST", "api.example.com");
    expect(decideGovernedAction({
      action: "fetch",
      risk: "read",
      description: "external fetch",
      networkEgress: true,
      destinationHost: "evil.example.net",
    }).decision).toBe("deny");
    vi.unstubAllEnvs();
  });

  it("allows allowlisted read egress", () => {
    vi.stubEnv("ONYX_AGENT_EGRESS_ALLOWLIST", "api.example.com");
    expect(decideGovernedAction({
      action: "fetch",
      risk: "read",
      description: "trusted read",
      networkEgress: true,
      destinationHost: "https://api.example.com/v1/data",
    }).decision).toBe("allow");
    vi.unstubAllEnvs();
  });

  it("denies eval egress combined with admin credentials", () => {
    vi.stubEnv("ONYX_AGENT_EGRESS_ALLOWLIST", "api.example.com");
    expect(decideGovernedAction({
      action: "probe",
      risk: "read",
      description: "evaluation probe",
      environment: "eval",
      networkEgress: true,
      destinationHost: "api.example.com",
      credentialAccess: true,
      credentialScope: "admin",
    }).decision).toBe("deny");
    vi.unstubAllEnvs();
  });

  it("requires a human gate for unverified mutating tool evidence", () => {
    expect(decideGovernedAction({
      action: "update",
      risk: "internal_write",
      description: "reversible write",
      reversible: true,
      toolEvidence: { source: "agent_claim", verified: false },
    }).decision).toBe("human_gate");
  });

  it("denies method violations even when the result looks useful", () => {
    expect(decideGovernedAction({
      action: "optimize",
      risk: "draft",
      description: "result-only optimization",
      methodCompliance: "violated",
    }).decision).toBe("deny");
  });

  it("authenticates trusted tool evidence", () => {
    const payload = JSON.stringify({ tool: "deploy", exitCode: 0 });
    const signature = signToolEvidence(payload, "test-key");
    expect(verifyToolEvidence(payload, signature, "test-key")).toBe(true);
    expect(verifyToolEvidence(payload + "x", signature, "test-key")).toBe(false);
  });
});
