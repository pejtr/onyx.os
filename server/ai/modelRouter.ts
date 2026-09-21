import {
  invokeLLM,
  type InvokeParams,
  type InvokeResult,
} from "../_core/llm";
import type {
  ModelRoutePlan,
  ModelRouteTarget,
  OnyxAiMode,
  OnyxAiTask,
} from "../../shared/aiFabric";

const DEFAULT_MODEL = "gemini-2.5-flash";

type ModelEnvironment = Pick<
  NodeJS.ProcessEnv,
  "ONYX_DEFAULT_MODEL" | "ONYX_FAST_MODEL" | "ONYX_EXPERT_MODEL" | "ONYX_SECONDARY_MODEL"
>;

function configuredModel(
  value: string | undefined,
  fallback: { model: string; source: ModelRouteTarget["source"] }
): { model: string; source: ModelRouteTarget["source"] } {
  const trimmed = value?.trim();
  return trimmed
    ? { model: trimmed, source: "environment" }
    : fallback;
}

export function resolveModelPlan(
  mode: OnyxAiMode,
  task: OnyxAiTask,
  env: ModelEnvironment = process.env
): ModelRoutePlan {
  const defaultTarget = configuredModel(env.ONYX_DEFAULT_MODEL, {
    model: DEFAULT_MODEL,
    source: "default",
  });
  const fast = configuredModel(env.ONYX_FAST_MODEL, defaultTarget);
  const expert = configuredModel(env.ONYX_EXPERT_MODEL, defaultTarget);

  const primaryConfig = mode === "FAST" ? fast : expert;
  const primary: ModelRouteTarget = {
    model: primaryConfig.model,
    lane: "primary",
    source: primaryConfig.source,
  };

  if (mode !== "PARALLEL") {
    return { mode, task, primary, targets: [primary] };
  }

  const rawTargets: ModelRouteTarget[] = [
    primary,
    {
      model: fast.model,
      lane: "secondary",
      source: fast.source,
    },
  ];

  const secondary = env.ONYX_SECONDARY_MODEL?.trim();
  if (secondary) {
    rawTargets.push({
      model: secondary,
      lane: "secondary",
      source: "environment",
    });
  }

  const seen = new Set<string>();
  const targets = rawTargets.filter((target) => {
    if (seen.has(target.model)) return false;
    seen.add(target.model);
    return true;
  });

  return { mode, task, primary, targets };
}

export interface RoutedAttempt {
  target: ModelRouteTarget;
  ok: boolean;
  error?: string;
  result?: InvokeResult;
}

export interface RoutedLlmResult {
  plan: ModelRoutePlan;
  primary: InvokeResult;
  attempts: RoutedAttempt[];
}

export async function invokeRoutedLLM(
  params: InvokeParams,
  route: { mode: OnyxAiMode; task: OnyxAiTask }
): Promise<RoutedLlmResult> {
  const plan = resolveModelPlan(route.mode, route.task);

  const settled = await Promise.all(
    plan.targets.map(async (target): Promise<RoutedAttempt> => {
      try {
        const result = await invokeLLM({ ...params, model: target.model });
        return { target, ok: true, result };
      } catch (error) {
        return {
          target,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  const primaryAttempt =
    settled.find((attempt) => attempt.ok && attempt.target.model === plan.primary.model) ??
    settled.find((attempt) => attempt.ok);

  if (!primaryAttempt?.result) {
    const reasons = settled
      .map((attempt) => `${attempt.target.model}: ${attempt.error ?? "unknown error"}`)
      .join("; ");
    throw new Error(`ONYX model route failed: ${reasons}`);
  }

  return {
    plan,
    primary: primaryAttempt.result,
    attempts: settled,
  };
}
