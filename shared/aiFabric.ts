export type OnyxAiMode = "FAST" | "EXPERT" | "PARALLEL";

export type OnyxAiTask =
  | "classification"
  | "chat"
  | "research"
  | "code"
  | "synthesis"
  | "extraction"
  | "planning";

export interface ModelRouteTarget {
  model: string;
  lane: "primary" | "secondary";
  source: "default" | "environment";
}

export interface ModelRoutePlan {
  mode: OnyxAiMode;
  task: OnyxAiTask;
  primary: ModelRouteTarget;
  targets: ModelRouteTarget[];
}

export type KnowledgeSourceKind =
  | "github"
  | "google-drive"
  | "notion"
  | "gmail"
  | "file"
  | "web"
  | "crm"
  | "manual";

export type KnowledgeTrust = "trusted" | "untrusted" | "unknown";

export interface KnowledgeProvenance {
  sourceId: string;
  sourceKind: KnowledgeSourceKind;
  documentId: string;
  chunkId: string;
  title?: string;
  uri?: string;
  version?: string;
  capturedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  trust: KnowledgeTrust;
  provenance: KnowledgeProvenance;
}

export type GovernedActionRisk =
  | "READ"
  | "EXTERNAL_WRITE"
  | "FINANCIAL"
  | "DESTRUCTIVE";

export interface GovernedAction {
  id: string;
  risk: GovernedActionRisk;
  description: string;
  targetVerified: boolean;
  requiresSecret?: boolean;
}

export type GateDecision = "AUTO" | "HUMAN_GATE" | "DENY";

export interface GateEvaluation {
  decision: GateDecision;
  reasons: string[];
}

export interface ProfitOpportunity {
  id: string;
  expectedRevenue: number;
  probability: number;
  grossMargin: number;
  hoursRequired: number;
  cashCost: number;
  risk: number;
  timeToRevenueDays: number;
  currency?: string;
}

export interface ProfitScore {
  opportunityId: string;
  expectedGrossProfit: number;
  speedFactor: number;
  riskFactor: number;
  priorityIndex: number;
  currency: string;
}
