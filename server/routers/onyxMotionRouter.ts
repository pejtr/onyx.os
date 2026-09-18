import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
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

export const onyxMotionRouter = router({
  capabilities: protectedProcedure.query(() => {
    return [
      { id: "web.motion.plan", provider: "ONYX_LOCAL", implemented: true, requiresExternalAdapter: false },
      { id: "web.motion.apply", provider: "MOTION_ANYTHING", implemented: true, requiresExternalAdapter: true },
      { id: "web.motion.preview", provider: "MOTION_ANYTHING", implemented: true, requiresExternalAdapter: true },
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
      return adapter.suggest(input);
    }),

  generateWebArtifact: adminProcedure
    .input(
      z.object({
        brief: z.string().min(10).max(6000),
        profile: profileSchema.default("PRODUCT"),
        designSystem: z.string().max(120).optional(),
        cli: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const adapter = new MotionAnythingAdapter();
      return adapter.generate({
        brief: input.brief,
        designSystem: input.designSystem,
        motionProfile: upstreamProfile(input.profile),
        cli: input.cli,
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
      }),
    )
    .mutation(async ({ input }) => {
      const adapter = new MotionAnythingAdapter();
      return adapter.edit({
        slug: input.slug,
        instruction: input.instruction,
        scope: input.scope,
        designSystem: input.designSystem,
        motionProfile: upstreamProfile(input.profile),
        cli: input.cli,
      });
    }),

  renderWebArtifact: adminProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(200),
        duration: z.number().min(1).max(60).default(15),
        resolution: z.enum(["landscape", "portrait"]).default("landscape"),
        quality: z.enum(["low", "medium", "high"]).default("high"),
      }),
    )
    .mutation(async ({ input }) => {
      const adapter = new MotionAnythingAdapter();
      return adapter.renderHtmlVideo(input);
    }),

  createVideoProject: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        intent: z.string().max(1000).optional(),
        preferences: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const adapter = new HtmlVideoAdapter();
      return adapter.createProject(input);
    }),

  exportVideoProject: adminProcedure
    .input(z.object({ projectId: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const adapter = new HtmlVideoAdapter();
      return adapter.exportProject(input.projectId);
    }),
});
