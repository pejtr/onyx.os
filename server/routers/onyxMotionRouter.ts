import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { decideGovernedAction } from "../governedExecution";
import {
  HtmlVideoAdapter,
  MotionAnythingAdapter,
  exportMotionCss,
  planOnyxMotion,
} from "../onyxMotion";
import {
  ONYX_MOTION_COMPONENT_KINDS,
  ONYX_MOTION_PROFILES,
  type OnyxMotionProfile,
} from "../../shared/onyxMotion";

const componentSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(ONYX_MOTION_COMPONENT_KINDS),
  priority: z.enum(["primary", "secondary", "ambient"]).optional(),
  label: z.string().max(200).optional(),
});

const profileSchema = z.enum(ONYX_MOTION_PROFILES);

function upstreamProfile(profile: OnyxMotionProfile) {
  if (profile === "SUBTLE") return "subtle";
  if (profile === "CINEMATIC") return "cinematic";
  return "lively";
}

function defaultMotionRuntimeCli() {
  return process.env.ONYX_MOTION_DEFAULT_CLI?.trim() || "byok";
}

function publicStatus<T extends { name: string; configured: boolean; reachable: boolean; detail?: string }>(
  status: T,
) {
  return {
    name: status.name,
    configured: status.configured,
    reachable: status.reachable,
    detail: status.detail,
  };
}

function requireExternalMotionApproval(
  action: string,
  description: string,
  humanApproved: true,
) {
  const governance = decideGovernedAction({
    action,
    risk: "external_write",
    description,
    reversible: true,
  });

  if (governance.decision !== "human_gate" || humanApproved !== true) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "HUMAN_APPROVAL_REQUIRED",
    });
  }

  return governance;
}

export const onyxMotionRouter = router({
  capabilities: protectedProcedure.query(() => {
    return [
      { id: "web.motion.plan", provider: "ONYX_LOCAL", implemented: true, requiresExternalAdapter: false },
      { id: "web.motion.apply", provider: "MOTION_ANYTHING", implemented: true, requiresExternalAdapter: true },
      { id: "web.motion.preview", provider: "MOTION_ANYTHING", implemented: false, requiresExternalAdapter: true },
      { id: "web.motion.export", provider: "MOTION_ANYTHING", implemented: true, requiresExternalAdapter: true },
      { id: "web.motion.fromReference", provider: "MOTION_ANYTHING", implemented: false, requiresExternalAdapter: true },
      { id: "web.video.fromPage", provider: "HTML_VIDEO", implemented: true, requiresExternalAdapter: true },
      { id: "web.video.fromComponent", provider: "HTML_VIDEO", implemented: true, requiresExternalAdapter: true },
      { id: "web.video.fromUrl", provider: "HTML_VIDEO", implemented: true, requiresExternalAdapter: true },
      { id: "web.video.render", provider: "HTML_VIDEO", implemented: true, requiresExternalAdapter: true },
    ] as const;
  }),

  profiles: protectedProcedure.query(() => [
    {
      id: "SUBTLE" as const,
      upstreamId: "subtle",
      description: "Minimal clarity-first motion; quick fades and essential state feedback.",
    },
    {
      id: "PRODUCT" as const,
      upstreamId: "lively",
      description: "Confident product motion; restrained stagger, responsive CTA feedback, no busy loops.",
    },
    {
      id: "CINEMATIC" as const,
      upstreamId: "cinematic",
      description: "Fewer, larger hero moments and deliberate reveals for launch/brand surfaces.",
    },
  ]),

  status: protectedProcedure.query(async () => {
    const motionAnything = new MotionAnythingAdapter();
    const htmlVideo = new HtmlVideoAdapter();

    const [motionStatus, videoStatus] = await Promise.all([
      motionAnything.status(),
      htmlVideo.status(),
    ]);

    return {
      localPlanner: {
        configured: true,
        reachable: true,
        detail: "Deterministic ONYX restraint planner is always available.",
      },
      adapters: [publicStatus(motionStatus), publicStatus(videoStatus)],
      policy: {
        adapterUrlsAreServerOnly: true,
        browserSecrets: false,
        maxAttentionPerViewport: 1,
        maxAmbientLoopsPerViewport: 1,
        maxSimultaneousEntrances: 3,
        prefersReducedMotionRequired: true,
      },
    };
  }),

  plan: protectedProcedure
    .input(
      z.object({
        profile: profileSchema.default("PRODUCT"),
        components: z.array(componentSchema).min(1).max(30),
      }),
    )
    .mutation(({ input }) => {
      return planOnyxMotion({
        profile: input.profile,
        components: input.components,
      });
    }),

  exportCss: protectedProcedure
    .input(
      z.object({
        profile: profileSchema.default("PRODUCT"),
        components: z.array(componentSchema).min(1).max(30),
      }),
    )
    .mutation(({ input }) => {
      const plan = planOnyxMotion({
        profile: input.profile,
        components: input.components,
      });
      return {
        plan,
        css: exportMotionCss(plan),
        runtimeItems: plan.items.filter((item) => item.requiresRuntime),
      };
    }),

  suggest: adminProcedure
    .input(
      z.object({
        instruction: z.string().min(3).max(1500),
        component: z.string().min(1).max(200),
        cli: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const adapter = new MotionAnythingAdapter();
      return adapter.suggest({
        ...input,
        cli: input.cli ?? defaultMotionRuntimeCli(),
      });
    }),

  generateWebArtifact: adminProcedure
    .input(
      z.object({
        brief: z.string().min(10).max(6000),
        profile: profileSchema.default("PRODUCT"),
        designSystem: z.string().max(120).optional(),
        cli: z.string().max(80).optional(),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.generateWebArtifact",
        "Create a generated artifact in the configured motion-anything runtime.",
        input.humanApproved,
      );
      const adapter = new MotionAnythingAdapter();
      return adapter.generate({
        brief: input.brief,
        designSystem: input.designSystem,
        motionProfile: upstreamProfile(input.profile),
        cli: input.cli ?? defaultMotionRuntimeCli(),
      });
    }),

  editWebArtifact: adminProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(200),
        instruction: z.string().min(3).max(4000),
        scope: z.string().max(500).optional(),
        profile: profileSchema.default("PRODUCT"),
        designSystem: z.string().max(120).optional(),
        cli: z.string().max(80).optional(),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.editWebArtifact",
        "Edit an artifact in the configured motion-anything runtime.",
        input.humanApproved,
      );
      const adapter = new MotionAnythingAdapter();
      return adapter.edit({
        slug: input.slug,
        instruction: input.instruction,
        scope: input.scope,
        designSystem: input.designSystem,
        motionProfile: upstreamProfile(input.profile),
        cli: input.cli ?? defaultMotionRuntimeCli(),
      });
    }),

  renderWebArtifact: adminProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(200),
        duration: z.number().min(1).max(60).default(15),
        resolution: z.enum(["landscape", "portrait"]).default("landscape"),
        quality: z.enum(["low", "medium", "high"]).default("high"),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.renderWebArtifact",
        "Render an external motion artifact to video.",
        input.humanApproved,
      );
      const adapter = new MotionAnythingAdapter();
      const { humanApproved: _humanApproved, ...request } = input;
      return adapter.renderHtmlVideo(request);
    }),

  videoFromUrl: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        url: z.string().url().max(2048),
        instruction: z.string().min(3).max(4000).optional(),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.videoFromUrl",
        "Create an external html-video project from a public page URL.",
        input.humanApproved,
      );
      const adapter = new HtmlVideoAdapter();
      const { humanApproved: _humanApproved, ...request } = input;
      return adapter.generateFromUrl(request);
    }),

  videoFromPage: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        html: z.string().min(20).max(250_000),
        instruction: z.string().min(3).max(4000).optional(),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.videoFromPage",
        "Create an external html-video project from page HTML.",
        input.humanApproved,
      );
      const adapter = new HtmlVideoAdapter();
      const { humanApproved: _humanApproved, ...request } = input;
      return adapter.generateFromHtml({
        ...request,
        sourceLabel: "ONYX WEBY full page HTML",
      });
    }),

  videoFromComponent: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        html: z.string().min(10).max(100_000),
        instruction: z.string().min(3).max(4000).optional(),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.videoFromComponent",
        "Create an external html-video project from component HTML.",
        input.humanApproved,
      );
      const adapter = new HtmlVideoAdapter();
      const { humanApproved: _humanApproved, ...request } = input;
      return adapter.generateFromHtml({
        ...request,
        sourceLabel: "ONYX WEBY component HTML",
      });
    }),

  createVideoProject: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        intent: z.string().max(1000).optional(),
        preferences: z.record(z.string(), z.unknown()).optional(),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.createVideoProject",
        "Create an external html-video project.",
        input.humanApproved,
      );
      const adapter = new HtmlVideoAdapter();
      const { humanApproved: _humanApproved, ...request } = input;
      return adapter.createProject(request);
    }),

  exportVideoProject: adminProcedure
    .input(
      z.object({
        projectId: z.string().min(1).max(200),
        humanApproved: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      requireExternalMotionApproval(
        "onyx.motion.exportVideoProject",
        "Render/export an external html-video project.",
        input.humanApproved,
      );
      const adapter = new HtmlVideoAdapter();
      return adapter.exportProject(input.projectId);
    }),
});
