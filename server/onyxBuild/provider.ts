import type {
  OnyxBuildCreateFromUrlInput,
  OnyxBuildPlan,
  OnyxBuildProviderId,
} from "../../shared/onyxBuild";

export interface OnyxBuildProvider {
  id: OnyxBuildProviderId;
  createFromUrl(input: OnyxBuildCreateFromUrlInput): Promise<OnyxBuildPlan>;
}
