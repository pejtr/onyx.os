export const ONYX_MOTION_PROFILES = ["SUBTLE", "PRODUCT", "CINEMATIC"] as const;
export type OnyxMotionProfile = (typeof ONYX_MOTION_PROFILES)[number];

export const ONYX_MOTION_TRIGGERS = ["load", "scroll", "hover", "click"] as const;
export type OnyxMotionTrigger = (typeof ONYX_MOTION_TRIGGERS)[number];

export const ONYX_MOTION_EFFECTS = [
  "fade",
  "rise",
  "scale",
  "pop",
  "pulse",
  "shake",
  "wobble",
  "sink",
  "blur",
  "typewriter",
  "count-up",
  "ambient",
] as const;
export type OnyxMotionEffect = (typeof ONYX_MOTION_EFFECTS)[number];

export const ONYX_MOTION_COMPONENT_KINDS = [
  "hero",
  "heading",
  "copy",
  "cta",
  "card",
  "stat",
  "image",
  "section",
  "background",
] as const;
export type OnyxMotionComponentKind = (typeof ONYX_MOTION_COMPONENT_KINDS)[number];

export type OnyxMotionPriority = "primary" | "secondary" | "ambient";

export interface OnyxMotionComponent {
  id: string;
  kind: OnyxMotionComponentKind;
  priority?: OnyxMotionPriority;
  label?: string;
}

export interface OnyxMotionItem {
  componentId: string;
  kind: OnyxMotionComponentKind;
  trigger: OnyxMotionTrigger;
  effect: OnyxMotionEffect;
  durationMs: number;
  delayMs: number;
  distancePx: number;
  easing: "ease-out" | "ease-in-out" | "spring" | "linear";
  attention: boolean;
  looping: boolean;
  gpuSafe: boolean;
  reducedMotion: "none" | "crossfade" | "scale-only";
  requiresRuntime: boolean;
  reason: string;
}

export interface OnyxMotionPlan {
  profile: OnyxMotionProfile;
  source: "ONYX_LOCAL" | "MOTION_ANYTHING";
  items: OnyxMotionItem[];
  warnings: string[];
  gates: {
    reducedMotionCovered: boolean;
    maxAttentionPerView: number;
    maxAmbientLoopsPerView: number;
    maxSimultaneousEntrances: number;
    gpuSafeOnly: boolean;
  };
}

export interface OnyxMotionAdapterStatus {
  name: "motion-anything" | "html-video";
  configured: boolean;
  reachable: boolean;
  baseUrl?: string;
  detail?: string;
}

export interface OnyxMotionCapability {
  id:
    | "web.motion.plan"
    | "web.motion.apply"
    | "web.motion.preview"
    | "web.motion.export"
    | "web.motion.fromReference"
    | "web.video.fromPage"
    | "web.video.fromComponent"
    | "web.video.fromUrl"
    | "web.video.render";
  provider: "ONYX_LOCAL" | "MOTION_ANYTHING" | "HTML_VIDEO" | "OMNI_VIDEO";
  implemented: boolean;
  requiresExternalAdapter: boolean;
}
