import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { decideGovernedAction } from "../governedExecution";
import { getOnyxBuildProvider } from "../onyxBuild/registry";

const createInput = z.object({
  sourceUrl: z.string().min(4),
  instruction: z.string().min(1).max(12000),
  provider: z.literal("open-lovable").default("open-lovable"),
  mode: z.literal("sandbox_only").default("sandbox_only"),
});

export const onyxBuildRouter = router({
  runtimeStatus: protectedProcedure
    .input(z.object({ provider: z.literal("open-lovable").default("open-lovable") }).optional())
    .query(({ input }) => getOnyxBuildProvider(input?.provider ?? "open-lovable").runtimeStatus()),

  createFromUrl: protectedProcedure
    .input(createInput)
    .mutation(async ({ input }) => {
      const governance = decideGovernedAction({
        action: "onyx.build.createFromUrl",
        risk: "draft",
        description: "Prepare a sandbox-only application build plan from an existing URL.",
        reversible: true,
      });

      if (governance.decision !== "allow") {
        return { ok: false as const, governance, plan: null };
      }

      const provider = getOnyxBuildProvider(input.provider);
      const plan = await provider.createFromUrl(input);
      return { ok: true as const, governance, plan };
    }),

  executeFromUrl: protectedProcedure
    .input(createInput)
    .mutation(async ({ input }) => {
      const governance = decideGovernedAction({
        action: "onyx.build.executeSandbox",
        risk: "internal_write",
        description:
          "Create an isolated ephemeral ONYX BUILD sandbox and verify generated application code.",
        reversible: true,
      });

      if (governance.decision !== "allow") {
        return { ok: false as const, governance, execution: null };
      }

      const provider = getOnyxBuildProvider(input.provider);
      const execution = await provider.executeFromUrl(input);
      return { ok: execution.status === "completed", governance, execution };
    }),

  gitWritePolicy: protectedProcedure.query(() => {
    const governance = decideGovernedAction({
      action: "onyx.build.proposeGitPatch",
      risk: "external_write",
      description: "Create or update Git repository state from an ONYX BUILD artifact.",
      reversible: true,
    });

    return {
      governance,
      expectedDecision: "human_gate" as const,
    };
  }),
});
