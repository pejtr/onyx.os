import { describe, expect, it } from "vitest";
import {
  MotionAnythingAdapter,
  exportMotionCss,
  planOnyxMotion,
} from "./onyxMotion";

describe("ONYX WEBY motion engine", () => {
  it("enforces one attention moment and one ambient loop", () => {
    const plan = planOnyxMotion({
      profile: "CINEMATIC",
      components: [
        { id: "hero", kind: "hero", priority: "primary" },
        { id: "stat-a", kind: "stat", priority: "secondary" },
        { id: "stat-b", kind: "stat", priority: "secondary" },
        { id: "bg-a", kind: "background", priority: "ambient" },
        { id: "bg-b", kind: "background", priority: "ambient" },
      ],
    });

    expect(plan.items.filter((item) => item.attention)).toHaveLength(1);
    expect(plan.items.filter((item) => item.looping)).toHaveLength(1);
    expect(plan.warnings.some((warning) => warning.includes("attention effect downgraded"))).toBe(true);
    expect(plan.warnings.some((warning) => warning.includes("ambient loop removed"))).toBe(true);
    expect(plan.gates.reducedMotionCovered).toBe(true);
  });

  it("keeps PRODUCT CTA interaction user-triggered", () => {
    const plan = planOnyxMotion({
      profile: "PRODUCT",
      components: [
        { id: "title", kind: "hero" },
        { id: "cta", kind: "cta", priority: "primary" },
      ],
    });

    const cta = plan.items.find((item) => item.componentId === "cta");
    expect(cta?.trigger).toBe("hover");
    expect(cta?.looping).toBe(false);
    expect(cta?.attention).toBe(false);
    expect(cta?.gpuSafe).toBe(true);
  });

  it("exports reduced-motion CSS and transform/opacity-only entrance rules", () => {
    const plan = planOnyxMotion({
      profile: "PRODUCT",
      components: [
        { id: "title", kind: "hero" },
        { id: "copy", kind: "copy" },
        { id: "cta", kind: "cta" },
      ],
    });

    const css = exportMotionCss(plan);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@keyframes onyx-rise");
    expect(css).not.toContain("transition: width");
    expect(css).not.toContain("transition: height");
    expect(css).not.toContain("left:");
    expect(css).not.toContain("top:");
  });

  it("deduplicates component ids", () => {
    const plan = planOnyxMotion({
      profile: "SUBTLE",
      components: [
        { id: "hero", kind: "hero" },
        { id: "hero", kind: "copy" },
      ],
    });

    expect(plan.items).toHaveLength(1);
  });

  it("does not expose or require an adapter when it is not configured", async () => {
    const adapter = new MotionAnythingAdapter("");
    const status = await adapter.status();

    expect(status.configured).toBe(false);
    expect(status.reachable).toBe(false);
    expect(status.baseUrl).toBeUndefined();
  });

  it("reports an adapter reachable through the private server-side probe", async () => {
    const adapter = new MotionAnythingAdapter("http://127.0.0.1:4399");
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ projects: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const status = await adapter.status(fakeFetch);

    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.name).toBe("motion-anything");
  });
});
