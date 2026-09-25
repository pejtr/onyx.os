import type {
  OnyxBuildCreateFromUrlInput,
  OnyxBuildPlan,
} from "../../shared/onyxBuild";
import type { OnyxBuildProvider } from "./provider";

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Open Lovable provider adapter v0.
 *
 * This first slice is intentionally sandbox-only. It defines the execution
 * contract and provider boundary without granting repository, deployment,
 * DNS, secret, or production write capabilities.
 *
 * Runtime execution (Firecrawl ingest + isolated Vercel/E2B sandbox) is the
 * next slice behind this adapter.
 */
export const openLovableProvider: OnyxBuildProvider = {
  id: "open-lovable",

  async createFromUrl(input: OnyxBuildCreateFromUrlInput): Promise<OnyxBuildPlan> {
    const sourceUrl = normalizeUrl(input.sourceUrl);

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
};
