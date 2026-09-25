import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { decideGovernedAction } from "../governedExecution";
import { getOnyxBuildProvider } from "../onyxBuild/registry";

export const onyxBuildRouter = router({
  createFromUrl: protectedProcedure
    .input(
      z.object({
        sourceUrl: z.string().min(4),
        instruction: z.string().min(1).max(12000),
        provider: z.literal("open-lovable").default("open-lovable"),
        mode: z.literal("sandbox_only").default("sandbox_only"),
      })
    )
    .mutation(async ({ input }) => {
      const governance = decideGovernedAction({
        action: "onyx.build.createFromUrl",
        risk: "draft",
        description:
          "Prepare a sandbox-only application build plan from an existing URL.",
        reversible: true,
      });

      if (governance.decision !== "allow") {
        return {
          ok: false as const,
          governance,
          plan: null,
        };
      }

      const provider = getOnyxBuildProvider(input.provider);
      const plan = await provider.createFromUrl(input);

      return {
        ok: true as const,
        governance,
        plan,
      };
    }),

  gitWritePolicy: protectedProcedure.query(() => {
    const governance = decideGovernedAction({
      action: "onyx.build.proposeGitPatch",
      risk: "external_write",
      description:
        "Create or update Git repository state from an ONYX BUILD artifact.",
      reversible: true,
    });

    return {
      governance,
      expectedDecision: "human_gate" as const,
    };
  }),
});
