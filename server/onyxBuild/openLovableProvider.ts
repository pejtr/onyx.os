import type {
  OnyxBuildCreateFromUrlInput,
  OnyxBuildPlan,
} from "../../shared/onyxBuild";
import type { OnyxBuildProvider } from "./provider";
import {
  executeOpenLovableBuild,
  getOpenLovableRuntimeStatus,
  validatePublicSourceUrl,
} from "./openLovableRuntime";

export const openLovableProvider: OnyxBuildProvider = {
  id: "open-lovable",

  runtimeStatus: getOpenLovableRuntimeStatus,

  async createFromUrl(input: OnyxBuildCreateFromUrlInput): Promise<OnyxBuildPlan> {
    const sourceUrl = validatePublicSourceUrl(input.sourceUrl);

    return {
      artifact: {
        sourceUrl,
        provider: "open-lovable",
        mode: "sandbox_only",
        sandboxId: null,
        previewUrl: null,
        filesChanged: [],
        verification: {
          install: "pending",
          build: "pending",
          typecheck: "pending",
          smoke: "pending",
        },
        productionTouched: false,
        mutationPolicy: "sandbox_only",
      },
      stages: [
        "ingest",
        "analyze",
        "plan",
        "generate",
        "sandbox",
        "verify",
        "preview",
        "propose",
      ],
      nextAction: "execute_sandbox_build",
      humanGateRequiredForGitWrite: true,
    };
  },

  executeFromUrl: executeOpenLovableBuild,
};
