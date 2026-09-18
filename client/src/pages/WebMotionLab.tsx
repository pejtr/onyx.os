import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  CircleOff,
  Clapperboard,
  Code2,
  Film,
  Gauge,
  Loader2,
  Play,
  Sparkles,
  WandSparkles,
} from "lucide-react";

type Profile = "SUBTLE" | "PRODUCT" | "CINEMATIC";

const DEFAULT_COMPONENTS = [
  { id: "hero-title", kind: "hero" as const, priority: "primary" as const, label: "Hero headline" },
  { id: "hero-copy", kind: "copy" as const, priority: "secondary" as const, label: "Hero copy" },
  { id: "primary-cta", kind: "cta" as const, priority: "primary" as const, label: "Primary CTA" },
  { id: "proof-stat", kind: "stat" as const, priority: "secondary" as const, label: "Proof / stat" },
  { id: "hero-background", kind: "background" as const, priority: "ambient" as const, label: "Ambient background" },
];

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  ) : (
    <CircleOff className="h-4 w-4 text-zinc-500" />
  );
}

export default function WebMotionLab() {
  const [profile, setProfile] = useState<Profile>("PRODUCT");
  const [brief, setBrief] = useState(
    "Premium ONYX WEBY landing page hero. Keep motion restrained, make the primary CTA feel responsive, and animate one proof statistic on scroll.",
  );
  const [css, setCss] = useState("");

  const statusQuery = trpc.onyxMotion.status.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const planMutation = trpc.onyxMotion.plan.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const cssMutation = trpc.onyxMotion.exportCss.useMutation({
    onSuccess: (result) => {
      setCss(result.css);
      toast.success("Motion CSS vytvořen");
    },
    onError: (error) => toast.error(error.message),
  });

  const generateMutation = trpc.onyxMotion.generateWebArtifact.useMutation({
    onSuccess: (result: any) => {
      toast.success(`motion-anything vytvořil artifact ${result?.slug ?? ""}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const motionAdapter = useMemo(
    () => statusQuery.data?.adapters.find((adapter) => adapter.name === "motion-anything"),
    [statusQuery.data],
  );
  const videoAdapter = useMemo(
    () => statusQuery.data?.adapters.find((adapter) => adapter.name === "html-video"),
    [statusQuery.data],
  );

  const runPlan = () => {
    planMutation.mutate({
      profile,
      components: DEFAULT_COMPONENTS,
    });
  };

  const runCss = () => {
    cssMutation.mutate({
      profile,
      components: DEFAULT_COMPONENTS,
    });
  };

  const generate = () => {
    if (!motionAdapter?.reachable) {
      toast.error("motion-anything adapter není připojen. Nastav ONYX_MOTION_ANYTHING_URL.");
      return;
    }
    generateMutation.mutate({ brief, profile });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              ONYX WEBY · Motion Layer
            </div>
            <h1 className="text-3xl font-bold tracking-tight">ONYX Motion Lab</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Restraint-first motion planning for live web components, with optional motion-anything
              execution and html-video / OMNI VIDEO export bridges.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            <Gauge className="h-4 w-4 text-emerald-400" />
            1 attention moment · 1 ambient loop · max 3 simultaneous entrances
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Activity className="h-4 w-4 text-emerald-400" />
              ONYX local planner
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Deterministic fallback. No external service required.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <StatusDot ok={true} />
              READY
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 font-semibold">
              <WandSparkles className="h-4 w-4 text-violet-400" />
              motion-anything
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Live component motion, artifact generation and HyperFrames export.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <StatusDot ok={Boolean(motionAdapter?.reachable)} />
              {motionAdapter?.reachable
                ? "CONNECTED"
                : motionAdapter?.configured
                  ? "DEGRADED"
                  : "NOT_CONFIGURED"}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Clapperboard className="h-4 w-4 text-sky-400" />
              html-video
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Multi-scene narrative / promo renderer and bridge to OMNI VIDEO.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <StatusDot ok={Boolean(videoAdapter?.reachable)} />
              {videoAdapter?.reachable
                ? "CONNECTED"
                : videoAdapter?.configured
                  ? "DEGRADED"
                  : "NOT_CONFIGURED"}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
            <div>
              <h2 className="font-semibold">Motion profile</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                SUBTLE = clarity, PRODUCT = confident UI, CINEMATIC = fewer larger moments.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["SUBTLE", "PRODUCT", "CINEMATIC"] as Profile[]).map((item) => (
                <Button
                  key={item}
                  variant={profile === item ? "default" : "outline"}
                  onClick={() => setProfile(item)}
                  className="text-xs"
                >
                  {item}
                </Button>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                ONYX WEBY brief
              </label>
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                className="min-h-32 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button onClick={runPlan} disabled={planMutation.isPending}>
                {planMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Plan
              </Button>
              <Button variant="outline" onClick={runCss} disabled={cssMutation.isPending}>
                <Code2 className="mr-2 h-4 w-4" />
                CSS
              </Button>
              <Button
                variant="outline"
                onClick={generate}
                disabled={generateMutation.isPending || !motionAdapter?.reachable}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                POC components
              </div>
              <div className="space-y-2">
                {DEFAULT_COMPONENTS.map((component) => (
                  <div
                    key={component.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <span>{component.label}</span>
                    <code className="text-xs text-violet-300">{component.kind}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Motion plan</h2>
                  <p className="text-xs text-muted-foreground">
                    Every item carries timing, easing, reduced-motion fallback and a reason.
                  </p>
                </div>
                {planMutation.data && (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {planMutation.data.items.length} motions
                  </span>
                )}
              </div>

              {!planMutation.data ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Spusť Plan a ONYX sestaví restraint-safe motion mapu.
                </div>
              ) : (
                <div className="space-y-3">
                  {planMutation.data.items.map((item) => (
                    <div
                      key={item.componentId}
                      className="rounded-xl border border-border/60 bg-background/50 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.componentId}</span>
                        <span className="rounded bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                          {item.trigger} → {item.effect}
                        </span>
                        {item.requiresRuntime && (
                          <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                            runtime
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {item.durationMs}ms · delay {item.delayMs}ms · {item.easing} · reduced:{" "}
                        {item.reducedMotion}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                    </div>
                  ))}

                  {planMutation.data.warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
                      {planMutation.data.warnings.map((warning) => (
                        <div key={warning}>• {warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-sky-400" />
                <h2 className="font-semibold">Dependency-free CSS export</h2>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-xs text-zinc-300">
                {css || "Generate CSS to see the ONYX-safe transform/opacity patch here."}
              </pre>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Film className="h-4 w-4 text-sky-400" />
                Video routing
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <div>Live page motion → motion-anything</div>
                <div>Simple HTML artifact MP4 → HyperFrames</div>
                <div>Multi-scene promo / Reel → html-video</div>
                <div>Distribution / transcoding → OMNI VIDEO</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
