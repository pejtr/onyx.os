import { afterEach, describe, expect, it } from "vitest";
import { onyxMotionRouter } from "./routers/onyxMotionRouter";
import {
  HtmlVideoAdapter,
  MotionAnythingAdapter,
  exportMotionCss,
  planOnyxMotion,
} from "./onyxMotion";


const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

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
  it("uses injected fetch for the motion-anything health probe", async () => {
    const calls: string[] = [];
    const fakeFetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ projects: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const adapter = new MotionAnythingAdapter("http://127.0.0.1:4399", fakeFetch);
    const status = await adapter.status();

    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(calls).toEqual(["http://127.0.0.1:4399/api/projects"]);
  });

  it("bridges a public page URL into an html-video project and waits for generation", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fakeFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      calls.push({
        url,
        method,
        body: typeof init.body === "string" ? init.body : undefined,
      });

      if (url.endsWith("/api/projects") && method === "POST") {
        return new Response(JSON.stringify({ project: { id: "video-1" } }), { status: 200 });
      }
      if (url.endsWith("/api/projects/video-1/messages") && method === "POST") {
        return new Response('data: {"type":"done"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      if (url.endsWith("/api/projects/video-1") && method === "GET") {
        return new Response(
          JSON.stringify({ project: { id: "video-1", frames: [{ graphNodeId: "hook" }] } }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const adapter = new HtmlVideoAdapter("http://127.0.0.1:3071", fakeFetch);
    const result = await adapter.generateFromUrl({
      name: "ONYX WEBY promo",
      url: "https://example.com/product",
      instruction: "Create a 15-second product promo.",
    });

    expect(result.project.id).toBe("video-1");
    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["POST", "http://127.0.0.1:3071/api/projects"],
      ["POST", "http://127.0.0.1:3071/api/projects/video-1/messages"],
      ["GET", "http://127.0.0.1:3071/api/projects/video-1"],
    ]);

    const message = calls[1]?.body ?? "";
    expect(message).toContain("https://example.com/product");
    expect(message).toContain("do not invent metrics");
  });

  it("blocks obvious private source URLs before html-video can fetch them", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;
    const adapter = new HtmlVideoAdapter("http://127.0.0.1:3071", fakeFetch);

    await expect(
      adapter.generateFromUrl({
        name: "blocked",
        url: "http://127.0.0.1/internal",
      }),
    ).rejects.toThrow("PRIVATE_SOURCE_URL_BLOCKED");

    expect(called).toBe(false);
  });

  it("attaches page HTML before asking html-video to generate a storyboard", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fakeFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      calls.push({ url, method, body: typeof init.body === "string" ? init.body : undefined });

      if (url.endsWith("/api/projects") && method === "POST") {
        return new Response(JSON.stringify({ project: { id: "page-1" } }), { status: 200 });
      }
      if (url.endsWith("/api/projects/page-1/assets") && method === "POST") {
        return new Response(JSON.stringify({ project: { id: "page-1" } }), { status: 200 });
      }
      if (url.endsWith("/api/projects/page-1/messages") && method === "POST") {
        return new Response('data: {"type":"done"}\n\n', { status: 200 });
      }
      if (url.endsWith("/api/projects/page-1") && method === "GET") {
        return new Response(JSON.stringify({ project: { id: "page-1", frames: [] } }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const adapter = new HtmlVideoAdapter("http://127.0.0.1:3071", fakeFetch);
    await adapter.generateFromHtml({
      name: "Page promo",
      html: "<!doctype html><html><body><h1>Real product claim</h1></body></html>",
      sourceLabel: "ONYX WEBY full page HTML",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:3071/api/projects",
      "http://127.0.0.1:3071/api/projects/page-1/assets",
      "http://127.0.0.1:3071/api/projects/page-1/messages",
      "http://127.0.0.1:3071/api/projects/page-1",
    ]);
    expect(calls[1]?.body).toContain("Real product claim");
    expect(calls[2]?.body).toContain("Use only claims that are supported");
  });


  it("rejects insecure remote adapter URLs in production but allows loopback sidecars", () => {
    process.env.NODE_ENV = "production";

    expect(() => new MotionAnythingAdapter("http://runtime.example.com")).toThrow(
      "Remote production adapter URL must use https",
    );
    expect(() => new MotionAnythingAdapter("http://127.0.0.1:4399")).not.toThrow();
    expect(() => new MotionAnythingAdapter("https://runtime.example.com")).not.toThrow();
  });

  it("requires explicit admin human approval before external artifact creation", async () => {
    const caller = onyxMotionRouter.createCaller({
      user: {
        id: 1,
        openId: "admin-test",
        email: "admin@example.com",
        name: "Admin",
        loginMethod: "test",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: {},
    } as any);

    await expect(
      caller.generateWebArtifact({
        brief: "Create a restrained product hero with one clear motion moment.",
        profile: "PRODUCT",
      } as any),
    ).rejects.toThrow();

    await expect(
      caller.generateWebArtifact({
        brief: "Create a restrained product hero with one clear motion moment.",
        profile: "PRODUCT",
        humanApproved: true,
      }),
    ).rejects.toThrow("MOTION_ANYTHING_NOT_CONFIGURED");
  });

});
