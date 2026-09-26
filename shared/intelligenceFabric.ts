export type OnyxModelMode = "fast" | "expert" | "parallel";

export type OnyxModelTask =
  | "general"
  | "classification"
  | "research"
  | "strategy"
  | "coding"
  | "synthesis"
  | "creative";

export interface ModelRouteRequest {
  mode?: OnyxModelMode;
  task?: OnyxModelTask;
  requireTools?: boolean;
  requireStructuredOutput?: boolean;
}

export interface ModelRoutePlan {
  mode: OnyxModelMode;
  primaryModel: string;
  candidateModels: string[];
  reason: string;
}

export type KnowledgeSourceKind =
  | "github"
  | "google-drive"
  | "notion"
  | "gmail"
  | "web"
  | "file"
  | "crm"
  | "manual";

export interface KnowledgeSourceRef {
  sourceId: string;
  kind: KnowledgeSourceKind;
  title: string;
  uri?: string;
  version?: string;
  capturedAt?: string;
}

export interface KnowledgeChunk {
  chunkId: string;
  source: KnowledgeSourceRef;
  text: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface KnowledgeHit {
  chunk: KnowledgeChunk;
  score: number;
  matchedTerms: string[];
}

export type GovernedActionRisk =
  | "read"
  | "draft"
  | "internal_write"
  | "external_write"
  | "financial"
  | "destructive";

export type GovernedDecision = "allow" | "human_gate" | "deny";

export interface GovernedAction {
  action: string;
  risk: GovernedActionRisk;
  description: string;
  reversible?: boolean;
  environment?: "dev" | "eval" | "staging" | "production";
  networkEgress?: boolean;
  destinationHost?: string;
  credentialAccess?: boolean;
  credentialScope?: "none" | "ephemeral" | "environment" | "shared" | "admin";
  toolEvidence?: {
    source: "trusted_wrapper" | "agent_claim" | "human";
    verified: boolean;
    id?: string;
  };
  methodCompliance?: "verified" | "unknown" | "violated";
}

export interface GovernedActionDecision {
  decision: GovernedDecision;
  reason: string;
}

export interface ProfitOpportunity {
  id: string;
  revenuePotential: number;
  probability: number;
  estimatedHours: number;
  directCost: number;
  risk: number;
  strategicFit: number;
}

export interface ProfitScore {
  score: number;
  expectedValue: number;
  effortAdjustedValue: number;
  reasons: string[];
}
