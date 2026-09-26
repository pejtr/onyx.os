export type OnyxBuildProviderId = "open-lovable";

export type OnyxBuildMode = "sandbox_only";

export type OnyxBuildStage =
  | "ingest"
  | "analyze"
  | "plan"
  | "generate"
  | "sandbox"
  | "verify"
  | "preview"
  | "propose";

export interface OnyxBuildCreateFromUrlInput {
  sourceUrl: string;
  instruction: string;
  provider?: OnyxBuildProviderId;
  mode?: OnyxBuildMode;
}

export type BuildCheckStatus = "pending" | "pass" | "fail" | "skipped";

export interface OnyxBuildVerification {
  install: BuildCheckStatus;
  build: BuildCheckStatus;
  typecheck: BuildCheckStatus;
  smoke: BuildCheckStatus;
}

export interface OnyxBuildArtifact {
  sourceUrl: string;
  provider: OnyxBuildProviderId;
  mode: OnyxBuildMode;
  sandboxId: string | null;
  previewUrl: string | null;
  filesChanged: string[];
  verification: OnyxBuildVerification;
  productionTouched: false;
  mutationPolicy: "sandbox_only";
}

export interface OnyxBuildPlan {
  artifact: OnyxBuildArtifact;
  stages: OnyxBuildStage[];
  nextAction: "execute_sandbox_build";
  humanGateRequiredForGitWrite: true;
}

export interface OnyxBuildRuntimeStatus {
  provider: OnyxBuildProviderId;
  configured: boolean;
  endpointConfigured: boolean;
  authConfigured: boolean;
  productionReady: boolean;
  reason: string | null;
}

export interface OnyxBuildExecution {
  status: "completed" | "failed";
  artifact: OnyxBuildArtifact;
  completedStages: OnyxBuildStage[];
  errors: string[];
  runtime: {
    provider: OnyxBuildProviderId;
    sandboxProvider: string | null;
  };
  humanGateRequiredForGitWrite: true;
}
