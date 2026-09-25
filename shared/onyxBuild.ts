export type OnyxBuildProviderId = "open-lovable";

export type OnyxBuildMode = "sandbox_only";

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
  stages: Array<
    | "ingest"
    | "analyze"
    | "plan"
    | "generate"
    | "sandbox"
    | "verify"
    | "preview"
    | "propose"
  >;
  nextAction: "execute_sandbox_build";
  humanGateRequiredForGitWrite: true;
}
