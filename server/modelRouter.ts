import type { ModelRoutePlan, ModelRouteRequest, OnyxModelMode } from "../shared/intelligenceFabric";

const DEFAULT_FAST_MODEL = "gemini-2.5-flash";

const csv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const unique = (values: string[]) => [...new Set(values)];

export function resolveModelPlan(request: ModelRouteRequest = {}): ModelRoutePlan {
  const mode: OnyxModelMode = request.mode ?? "fast";
  const fast = process.env.ONYX_MODEL_FAST?.trim() || DEFAULT_FAST_MODEL;
  const expert = process.env.ONYX_MODEL_EXPERT?.trim() || fast;
  const configuredParallel = csv(process.env.ONYX_MODEL_PARALLEL);

  if (mode === "parallel") {
    const candidates = unique(configuredParallel.length > 0 ? configuredParallel : [expert, fast]);
    return {
      mode,
      primaryModel: candidates[0],
      candidateModels: candidates,
      reason:
        candidates.length > 1
          ? "Parallel comparison requested; using configured model ensemble."
          : "Parallel comparison requested but only one model is configured; degraded safely to one candidate.",
    };
  }

  if (mode === "expert") {
    return {
      mode,
      primaryModel: expert,
      candidateModels: [expert],
      reason: "Expert mode requested; using the configured expert model.",
    };
  }

  return {
    mode: "fast",
    primaryModel: fast,
    candidateModels: [fast],
    reason: "Fast mode is the safe default for ordinary requests.",
  };
}
