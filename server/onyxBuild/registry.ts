import type { OnyxBuildProviderId } from "../../shared/onyxBuild";
import type { OnyxBuildProvider } from "./provider";
import { openLovableProvider } from "./openLovableProvider";

const providers: Record<OnyxBuildProviderId, OnyxBuildProvider> = {
  "open-lovable": openLovableProvider,
};

export function getOnyxBuildProvider(
  providerId: OnyxBuildProviderId = "open-lovable"
): OnyxBuildProvider {
  return providers[providerId];
}
