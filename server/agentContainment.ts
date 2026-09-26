import { createHmac, timingSafeEqual } from "node:crypto";

export type AgentEnvironment = "dev" | "eval" | "staging" | "production";
export type CredentialScope = "none" | "ephemeral" | "environment" | "shared" | "admin";

export interface ToolEvidence {
  source: "trusted_wrapper" | "agent_claim" | "human";
  verified: boolean;
  id?: string;
}

export interface ContainmentContext {
  environment?: AgentEnvironment;
  networkEgress?: boolean;
  destinationHost?: string;
  credentialAccess?: boolean;
  credentialScope?: CredentialScope;
  toolEvidence?: ToolEvidence;
  methodCompliance?: "verified" | "unknown" | "violated";
}

function normalizeHost(host?: string): string {
  if (!host) return "";
  try {
    return new URL(host.includes("://") ? host : `https://${host}`).hostname.toLowerCase();
  } catch {
    return host.trim().toLowerCase();
  }
}

export function getAgentEgressAllowlist(): string[] {
  return (process.env.ONYX_AGENT_EGRESS_ALLOWLIST ?? "")
    .split(",")
    .map((item) => normalizeHost(item))
    .filter(Boolean);
}

export function isEgressAllowed(host?: string, allowlist = getAgentEgressAllowlist()): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return allowlist.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

export function signToolEvidence(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function verifyToolEvidence(payload: string, signature: string, key: string): boolean {
  const expected = Buffer.from(signToolEvidence(payload, key), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
