import type {
  OnyxBuildCreateFromUrlInput,
  OnyxBuildExecution,
  OnyxBuildPlan,
  OnyxBuildProviderId,
  OnyxBuildRuntimeStatus,
} from "../../shared/onyxBuild";

export interface OnyxBuildProvider {
  id: OnyxBuildProviderId;
  createFromUrl(input: OnyxBuildCreateFromUrlInput): Promise<OnyxBuildPlan>;
  executeFromUrl(input: OnyxBuildCreateFromUrlInput): Promise<OnyxBuildExecution>;
  runtimeStatus(): OnyxBuildRuntimeStatus;
}
