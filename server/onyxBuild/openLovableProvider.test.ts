import { describe, expect, it } from "vitest";
import { openLovableProvider } from "./openLovableProvider";
import { getOpenLovableRuntimeStatus, validatePublicSourceUrl } from "./openLovableRuntime";

describe("openLovableProvider", () => {
  it("creates a sandbox-only plan and never marks production as touched", async () => {
    const plan = await openLovableProvider.createFromUrl({
      sourceUrl: "example.com",
      instruction: "Rebuild this site as an editable React application.",
      provider: "open-lovable",
      mode: "sandbox_only",
    });

    expect(plan.artifact.sourceUrl).toBe("https://example.com/");
    expect(plan.artifact.provider).toBe("open-lovable");
    expect(plan.artifact.productionTouched).toBe(false);
    expect(plan.artifact.mutationPolicy).toBe("sandbox_only");
    expect(plan.humanGateRequiredForGitWrite).toBe(true);
    expect(plan.stages).toContain("sandbox");
    expect(plan.stages).toContain("verify");
  });

  it("rejects private and credential-bearing source URLs", () => {
    expect(() => validatePublicSourceUrl("http://127.0.0.1:3000")).toThrow();
    expect(() => validatePublicSourceUrl("http://192.168.1.10")).toThrow();
    expect(() => validatePublicSourceUrl("https://user:pass@example.com")).toThrow();
    expect(validatePublicSourceUrl("https://fdexample.com")).toBe("https://fdexample.com/");
  });

  it("requires authentication for a remote production runtime", () => {
    const previous = {
      nodeEnv: process.env.NODE_ENV,
      url: process.env.ONYX_OPEN_LOVABLE_URL,
      token: process.env.ONYX_OPEN_LOVABLE_TOKEN,
    };

    try {
      process.env.NODE_ENV = "production";
      process.env.ONYX_OPEN_LOVABLE_URL = "https://runtime.example.com";
      delete process.env.ONYX_OPEN_LOVABLE_TOKEN;

      const status = getOpenLovableRuntimeStatus();
      expect(status.configured).toBe(false);
      expect(status.productionReady).toBe(false);
      expect(status.reason).toContain("ONYX_OPEN_LOVABLE_TOKEN");
    } finally {
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.url === undefined) delete process.env.ONYX_OPEN_LOVABLE_URL;
      else process.env.ONYX_OPEN_LOVABLE_URL = previous.url;
      if (previous.token === undefined) delete process.env.ONYX_OPEN_LOVABLE_TOKEN;
      else process.env.ONYX_OPEN_LOVABLE_TOKEN = previous.token;
    }
  });
});
