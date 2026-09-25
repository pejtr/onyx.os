import { describe, expect, it } from "vitest";
import { openLovableProvider } from "./openLovableProvider";

describe("openLovableProvider", () => {
  it("creates a sandbox-only plan and never marks production as touched", async () => {
    const plan = await openLovableProvider.createFromUrl({
      sourceUrl: "example.com",
      instruction: "Rebuild this site as an editable React application.",
      provider: "open-lovable",
      mode: "sandbox_only",
    });

    expect(plan.artifact.sourceUrl).toBe("https://example.com");
    expect(plan.artifact.provider).toBe("open-lovable");
    expect(plan.artifact.productionTouched).toBe(false);
    expect(plan.artifact.mutationPolicy).toBe("sandbox_only");
    expect(plan.humanGateRequiredForGitWrite).toBe(true);
    expect(plan.stages).toContain("sandbox");
    expect(plan.stages).toContain("verify");
  });
});
