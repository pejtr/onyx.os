import type {
  OnyxMotionAdapterStatus,
  OnyxMotionComponent,
  OnyxMotionEffect,
  OnyxMotionItem,
  OnyxMotionPlan,
  OnyxMotionProfile,
  OnyxMotionTrigger,
} from "../shared/onyxMotion";

const PROFILE_RULES: Record<
  OnyxMotionProfile,
  {
    baseDuration: number;
    travel: number;
    maxItems: number;
    allowAmbient: boolean;
    heroEffect: OnyxMotionEffect;
    supportEffect: OnyxMotionEffect;
  }
> = {
  SUBTLE: {
    baseDuration: 220,
    travel: 12,
    maxItems: 4,
    allowAmbient: false,
    heroEffect: "fade",
    supportEffect: "rise",
  },
  PRODUCT: {
    baseDuration: 300,
    travel: 24,
    maxItems: 6,
    allowAmbient: false,
    heroEffect: "rise",
    supportEffect: "rise",
  },
  CINEMATIC: {
    baseDuration: 520,
    travel: 36,
    maxItems: 7,
    allowAmbient: true,
    heroEffect: "blur",
    supportEffect: "rise",
  },
};

const ATTENTION_EFFECTS = new Set<OnyxMotionEffect>([
  "pop",
  "pulse",
  "shake",
  "wobble",
  "typewriter",
  "count-up",
]);

function chooseEffect(
  component: OnyxMotionComponent,
  profile: OnyxMotionProfile,
): Pick<OnyxMotionItem, "trigger" | "effect" | "attention" | "looping" | "requiresRuntime"> {
  const rules = PROFILE_RULES[profile];

  if (component.kind === "background" && rules.allowAmbient) {
    return {
      trigger: "load",
      effect: "ambient",
      attention: false,
      looping: true,
      requiresRuntime: true,
    };
  }

  if (component.kind === "cta") {
    return {
      trigger: "hover",
      effect: profile === "SUBTLE" ? "scale" : "pop",
      attention: false,
      looping: false,
      requiresRuntime: false,
    };
  }

  if (component.kind === "stat") {
    return {
      trigger: "scroll",
      effect: "count-up",
      attention: true,
      looping: false,
      requiresRuntime: true,
    };
  }

  if (component.kind === "hero" || component.kind === "heading") {
    return {
      trigger: "load",
      effect: rules.heroEffect,
      attention: profile === "CINEMATIC",
      looping: false,
      requiresRuntime: rules.heroEffect === "blur",
    };
  }

  return {
    trigger: "scroll",
    effect: rules.supportEffect,
    attention: false,
    looping: false,
    requiresRuntime: false,
  };
}

function reducedMotionFor(effect: OnyxMotionEffect): OnyxMotionItem["reducedMotion"] {
  if (effect === "fade") return "crossfade";
  if (effect === "scale" || effect === "pop") return "scale-only";
  return "none";
}

function durationFor(profile: OnyxMotionProfile, effect: OnyxMotionEffect) {
  const base = PROFILE_RULES[profile].baseDuration;
  if (effect === "ambient") return 1600;
  if (effect === "pop" || effect === "scale") return Math.min(base, 260);
  if (effect === "count-up" || effect === "typewriter") return Math.max(base, 520);
  return base;
}

function sanitizeComponents(components: OnyxMotionComponent[]) {
  const ids = new Set<string>();
  return components
    .filter((component) => {
      const id = component.id.trim();
      if (!id || ids.has(id)) return false;
      ids.add(id);
      return true;
    })
    .map((component) => ({
      ...component,
      id: component.id.trim(),
    }));
}

/**
 * Deterministic, dependency-free ONYX fallback planner.
 *
 * The upstream motion-anything runtime remains optional. ONYX WEBY can always
 * produce a restrained motion plan even if the adapter is offline.
 */
export function planOnyxMotion(input: {
  profile: OnyxMotionProfile;
  components: OnyxMotionComponent[];
}): OnyxMotionPlan {
  const rules = PROFILE_RULES[input.profile];
  const components = sanitizeComponents(input.components).slice(0, rules.maxItems);
  const warnings: string[] = [];
  const items: OnyxMotionItem[] = [];

  let attentionCount = 0;
  let ambientLoops = 0;
  let entranceIndex = 0;

  for (const component of components) {
    const selected = chooseEffect(component, input.profile);

    if (selected.looping && ambientLoops >= 1) {
      warnings.push(
        `${component.id}: ambient loop removed — ONYX allows at most one ambient loop per viewport.`,
      );
      continue;
    }

    let effect = selected.effect;
    let attention = selected.attention;

    if (attention && attentionCount >= 1) {
      effect = "rise";
      attention = false;
      warnings.push(
        `${component.id}: attention effect downgraded to rise — restraint budget allows one attention moment.`,
      );
    }

    const trigger: OnyxMotionTrigger = selected.trigger;
    const isEntrance = !selected.looping && (trigger === "load" || trigger === "scroll");
    const delayMs = isEntrance ? Math.min(240, entranceIndex++ * 60) : 0;

    if (isEntrance && entranceIndex > 3) {
      warnings.push(
        `${component.id}: entrance is staggered beyond the first three simultaneous reveals.`,
      );
    }

    if (attention) attentionCount++;
    if (selected.looping) ambientLoops++;

    items.push({
      componentId: component.id,
      kind: component.kind,
      trigger,
      effect,
      durationMs: durationFor(input.profile, effect),
      delayMs,
      distancePx: effect === "rise" ? rules.travel : 0,
      easing:
        effect === "ambient"
          ? "linear"
          : effect === "pop" || effect === "scale"
            ? "spring"
            : "ease-out",
      attention,
      looping: selected.looping,
      gpuSafe: true,
      reducedMotion: reducedMotionFor(effect),
      requiresRuntime:
        selected.requiresRuntime ||
        (ATTENTION_EFFECTS.has(effect) && effect !== "pop" && effect !== "pulse"),
      reason:
        component.kind === "cta"
          ? "Interactive feedback only; no autoplay attention grab."
          : component.kind === "stat"
            ? "Stat motion waits for viewport entry and is capped to one attention moment."
            : component.kind === "background"
              ? "Ambient motion is allowed only once per viewport."
              : "Restrained entrance communicates hierarchy without competing with the CTA.",
    });
  }

  return {
    profile: input.profile,
    source: "ONYX_LOCAL",
    items,
    warnings,
    gates: {
      reducedMotionCovered: true,
      maxAttentionPerView: 1,
      maxAmbientLoopsPerView: 1,
      maxSimultaneousEntrances: 3,
      gpuSafeOnly: true,
    },
  };
}

function selectorFor(id: string) {
  const escaped = id.replace(/["\\]/g, "\\$&");
  return `[data-onyx-motion="${escaped}"]`;
}

/**
 * Exports dependency-free CSS for effects ONYX can express safely with
 * transform/opacity. Runtime-only effects remain described in the plan.
 */
export function exportMotionCss(plan: OnyxMotionPlan) {
  const blocks: string[] = [
    "/* ONYX WEBY Motion — generated from a restrained motion plan. */",
  ];

  for (const item of plan.items) {
    if (item.requiresRuntime || item.effect === "ambient") continue;
    const selector = selectorFor(item.componentId);
    const duration = `${item.durationMs}ms`;
    const delay = `${item.delayMs}ms`;

    if (item.trigger === "hover") {
      const transform =
        item.effect === "pop" || item.effect === "scale"
          ? "scale(1.025)"
          : item.effect === "sink"
            ? "translateY(2px)"
            : "scale(1)";
      blocks.push(
        `${selector} { transition: transform ${duration} cubic-bezier(0.16,1,0.3,1), opacity ${duration} ease-out; }`,
        `${selector}:hover { transform: ${transform}; }`,
      );
      continue;
    }

    if (item.effect === "fade") {
      blocks.push(
        `${selector}[data-onyx-state="enter"] { animation: onyx-fade ${duration} ease-out ${delay} both; }`,
      );
      continue;
    }

    if (item.effect === "rise") {
      blocks.push(
        `${selector}[data-onyx-state="enter"] { --onyx-travel: ${item.distancePx}px; animation: onyx-rise ${duration} cubic-bezier(0.16,1,0.3,1) ${delay} both; }`,
      );
    }
  }

  blocks.push(
    "@keyframes onyx-fade { from { opacity: 0; } to { opacity: 1; } }",
    "@keyframes onyx-rise { from { opacity: 0; transform: translateY(var(--onyx-travel, 20px)); } to { opacity: 1; transform: translateY(0); } }",
    "@media (prefers-reduced-motion: reduce) {",
    '  [data-onyx-motion] { animation: none !important; transition-duration: 80ms !important; transform: none !important; }',
    "}",
  );

  return blocks.join("\n");
}

type FetchLike = typeof fetch;

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: FetchLike = fetch,
  token?: string | null,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetchImpl(url, {
      ...init,
      headers,
      redirect: "error",
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body)}`);
    }
    return body as any;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: FetchLike = fetch,
  token?: string | null,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await fetchImpl(url, {
      ...init,
      headers,
      redirect: "error",
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function assertPublicSourceUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SOURCE_URL_MUST_BE_HTTP");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^\[?f[cd][0-9a-f]{2}:/i.test(host) ||
    /^\[?fe[89ab][0-9a-f]:/i.test(host)
  ) {
    throw new Error("PRIVATE_SOURCE_URL_BLOCKED");
  }
  return url.toString();
}

function isLoopbackAdapterHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function normalizedBaseUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Adapter URL must use http or https.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:" &&
    !isLoopbackAdapterHost(url.hostname)
  ) {
    throw new Error("Remote production adapter URL must use https.");
  }
  return url.toString().replace(/\/$/, "");
}

export class MotionAnythingAdapter {
  readonly name = "motion-anything" as const;
  readonly baseUrl: string | null;
  private readonly fetchImpl: FetchLike;
  private readonly token: string | null;

  constructor(
    baseUrl = process.env.ONYX_MOTION_ANYTHING_URL,
    fetchImpl: FetchLike = fetch,
    token = process.env.ONYX_MOTION_ANYTHING_TOKEN,
  ) {
    this.baseUrl = normalizedBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
    this.token = token?.trim() || null;
  }

  async status(fetchImpl: FetchLike = this.fetchImpl): Promise<OnyxMotionAdapterStatus> {
    if (!this.baseUrl) {
      return {
        name: this.name,
        configured: false,
        reachable: false,
        detail: "Set ONYX_MOTION_ANYTHING_URL to the private motion-anything service.",
      };
    }
    try {
      await fetchJson(
        `${this.baseUrl}/api/projects`,
        { method: "GET" },
        2500,
        fetchImpl,
        this.token,
      );
      return {
        name: this.name,
        configured: true,
        reachable: true,
        baseUrl: this.baseUrl,
        detail: "motion-anything API reachable",
      };
    } catch (error) {
      return {
        name: this.name,
        configured: true,
        reachable: false,
        baseUrl: this.baseUrl,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async suggest(input: {
    instruction: string;
    component: string;
    cli?: string;
  }) {
    if (!this.baseUrl) throw new Error("MOTION_ANYTHING_NOT_CONFIGURED");
    return fetchJson(
      `${this.baseUrl}/api/motion-suggest`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instruction: input.instruction,
          component: input.component,
          cli: input.cli,
          triggers: ["load", "scroll", "hover", "click"],
          effects: ["fade", "rise", "scale", "pop", "pulse", "shake", "wobble", "sink"],
        }),
      },
      125000,
      this.fetchImpl,
      this.token,
    );
  }

  async generate(input: {
    brief: string;
    designSystem?: string;
    motionProfile?: string;
    cli?: string;
  }) {
    if (!this.baseUrl) throw new Error("MOTION_ANYTHING_NOT_CONFIGURED");
    return fetchJson(
      `${this.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      245000,
      this.fetchImpl,
      this.token,
    );
  }

  async edit(input: {
    slug: string;
    instruction: string;
    scope?: string;
    designSystem?: string;
    motionProfile?: string;
    cli?: string;
  }) {
    if (!this.baseUrl) throw new Error("MOTION_ANYTHING_NOT_CONFIGURED");
    return fetchJson(
      `${this.baseUrl}/api/edit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      245000,
      this.fetchImpl,
      this.token,
    );
  }

  async renderHtmlVideo(input: {
    slug: string;
    duration?: number;
    resolution?: "landscape" | "portrait";
    quality?: "low" | "medium" | "high";
  }) {
    if (!this.baseUrl) throw new Error("MOTION_ANYTHING_NOT_CONFIGURED");
    return fetchJson(
      `${this.baseUrl}/api/hf-render`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      600000,
      this.fetchImpl,
      this.token,
    );
  }
}

export class HtmlVideoAdapter {
  readonly name = "html-video" as const;
  readonly baseUrl: string | null;
  private readonly fetchImpl: FetchLike;
  private readonly token: string | null;

  constructor(
    baseUrl = process.env.ONYX_HTML_VIDEO_URL,
    fetchImpl: FetchLike = fetch,
    token = process.env.ONYX_HTML_VIDEO_TOKEN,
  ) {
    this.baseUrl = normalizedBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
    this.token = token?.trim() || null;
  }

  private requireBaseUrl() {
    if (!this.baseUrl) throw new Error("HTML_VIDEO_NOT_CONFIGURED");
    return this.baseUrl;
  }

  async status(fetchImpl: FetchLike = this.fetchImpl): Promise<OnyxMotionAdapterStatus> {
    if (!this.baseUrl) {
      return {
        name: this.name,
        configured: false,
        reachable: false,
        detail: "Set ONYX_HTML_VIDEO_URL to the private html-video Studio service.",
      };
    }
    try {
      await fetchJson(
        `${this.baseUrl}/api/projects`,
        { method: "GET" },
        2500,
        fetchImpl,
        this.token,
      );
      return {
        name: this.name,
        configured: true,
        reachable: true,
        baseUrl: this.baseUrl,
        detail: "html-video Studio API reachable",
      };
    } catch (error) {
      return {
        name: this.name,
        configured: true,
        reachable: false,
        baseUrl: this.baseUrl,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async createProject(input: {
    name: string;
    intent?: string;
    preferences?: Record<string, unknown>;
  }) {
    const baseUrl = this.requireBaseUrl();
    return fetchJson(
      `${baseUrl}/api/projects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
      15000,
      this.fetchImpl,
      this.token,
    );
  }

  async getProject(projectId: string) {
    const baseUrl = this.requireBaseUrl();
    return fetchJson(
      `${baseUrl}/api/projects/${encodeURIComponent(projectId)}`,
      { method: "GET" },
      15000,
      this.fetchImpl,
      this.token,
    );
  }

  async addTextAsset(projectId: string, content: string, caption?: string) {
    const baseUrl = this.requireBaseUrl();
    return fetchJson(
      `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/assets`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "text", content, caption }),
      },
      30000,
      this.fetchImpl,
      this.token,
    );
  }

  async sendMessage(projectId: string, content: string) {
    const baseUrl = this.requireBaseUrl();
    await fetchText(
      `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/messages`,
      {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({ content }),
      },
      600000,
      this.fetchImpl,
      this.token,
    );
    return this.getProject(projectId);
  }

  async generateFromUrl(input: {
    name: string;
    url: string;
    instruction?: string;
  }) {
    const sourceUrl = assertPublicSourceUrl(input.url);
    const created = await this.createProject({
      name: input.name,
      intent: "ONYX WEBY page URL to multi-scene promo video",
      preferences: { source: "ONYX_WEBY", sourceType: "url" },
    });
    const projectId = created?.project?.id;
    if (!projectId) throw new Error("HTML_VIDEO_PROJECT_ID_MISSING");

    return this.sendMessage(
      String(projectId),
      [
        input.instruction || "Create a concise launch/promo video from this page.",
        "Preserve the source's real claims and brand language; do not invent metrics.",
        "Aim for a clear hook → value → proof → CTA story and keep motion restrained.",
        sourceUrl,
      ].join("\n"),
    );
  }

  async generateFromHtml(input: {
    name: string;
    html: string;
    instruction?: string;
    sourceLabel?: string;
  }) {
    const created = await this.createProject({
      name: input.name,
      intent: "ONYX WEBY HTML/component to multi-scene promo video",
      preferences: { source: "ONYX_WEBY", sourceType: "html" },
    });
    const projectId = created?.project?.id;
    if (!projectId) throw new Error("HTML_VIDEO_PROJECT_ID_MISSING");

    await this.addTextAsset(
      String(projectId),
      input.html,
      input.sourceLabel || "ONYX WEBY source HTML",
    );

    return this.sendMessage(
      String(projectId),
      [
        input.instruction || "Create a concise 15-second launch/promo video from the attached ONYX WEBY source.",
        "Use only claims that are supported by the attached source.",
        "Create a multi-frame hook → value → proof → CTA story.",
        "Keep brand hierarchy and motion restrained; prefer readable kinetic typography over decorative noise.",
      ].join("\n"),
    );
  }

  async exportProject(projectId: string) {
    const baseUrl = this.requireBaseUrl();
    return fetchJson(
      `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/export`,
      { method: "POST" },
      600000,
      this.fetchImpl,
      this.token,
    );
  }
}

