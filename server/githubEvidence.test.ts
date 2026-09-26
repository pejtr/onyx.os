import { describe, expect, it, vi } from "vitest";
import {
  chunkGitHubText,
  fetchGitHubEvidenceFile,
  normalizeGitHubPath,
  normalizeGitHubRef,
  resolveGitHubRepoAccess,
} from "./githubEvidence";

describe("GitHub Evidence connector", () => {
  it("uses the server token only for explicitly allowlisted repositories", () => {
    const policy = {
      token: "server-secret",
      allowedRepos: new Set(["pejtr/private-repo"]),
      trustedRepos: new Set(["pejtr/onyx.os"]),
    };

    expect(resolveGitHubRepoAccess("pejtr", "public-repo", policy)).toEqual({
      repoKey: "pejtr/public-repo",
      useToken: false,
      trust: "unknown",
    });

    expect(resolveGitHubRepoAccess("Pejtr", "private-repo", policy)).toEqual({
      repoKey: "pejtr/private-repo",
      useToken: true,
      trust: "unknown",
    });

    expect(resolveGitHubRepoAccess("Pejtr", "ONYX.OS", policy).trust).toBe(
      "trusted"
    );
  });

  it("rejects path/ref traversal and normalizes ordinary paths", () => {
    expect(() => normalizeGitHubPath("../secret.txt")).toThrow(
      "Invalid GitHub path"
    );
    expect(() => normalizeGitHubRef("../main")).toThrow("Invalid GitHub ref");
    expect(normalizeGitHubPath("/docs/architecture.md")).toBe(
      "docs/architecture.md"
    );
    expect(normalizeGitHubRef("feature/knowledge")).toBe("feature/knowledge");
  });

  it("chunks large text with bounded overlap", () => {
    const text = Array.from(
      { length: 120 },
      (_, index) => `line-${index.toString().padStart(3, "0")} ${"x".repeat(20)}`
    ).join("\n");

    const chunks = chunkGitHubText(text, { maxChars: 700, overlap: 100 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 700)).toBe(true);
    expect(chunks[1].start).toBeLessThan(chunks[0].end);
  });

  it("preserves provenance and never sends a token outside the allowlist", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBeNull();
      expect(init?.redirect).toBe("error");
      return new Response("alpha beta gamma", {
        status: 200,
        headers: { "content-length": "16" },
      });
    });

    const result = await fetchGitHubEvidenceFile(
      {
        owner: "pejtr",
        repo: "public-repo",
        path: "docs/readme.md",
        ref: "main",
      },
      {
        fetchImpl: fetchImpl as typeof fetch,
        now: () => new Date("2026-09-26T10:00:00.000Z"),
        policy: {
          token: "server-secret",
          allowedRepos: new Set(["pejtr/private-repo"]),
          trustedRepos: new Set(),
        },
      }
    );

    expect(result.authenticated).toBe(false);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].source.kind).toBe("github");
    expect(result.chunks[0].source.sourceId).toBe("github:pejtr/public-repo");
    expect(result.chunks[0].source.capturedAt).toBe(
      "2026-09-26T10:00:00.000Z"
    );
    expect(result.chunks[0].metadata?.trust).toBe("unknown");
  });

  it("sends the read token only to an allowlisted repository", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer server-secret");
      return new Response("trusted evidence", { status: 200 });
    });

    const result = await fetchGitHubEvidenceFile(
      {
        owner: "pejtr",
        repo: "onyx.os",
        path: "README.md",
      },
      {
        fetchImpl: fetchImpl as typeof fetch,
        policy: {
          token: "server-secret",
          allowedRepos: new Set(["pejtr/onyx.os"]),
          trustedRepos: new Set(["pejtr/onyx.os"]),
        },
      }
    );

    expect(result.authenticated).toBe(true);
    expect(result.trust).toBe("trusted");
    expect(result.chunks[0].metadata?.trust).toBe("trusted");
  });
});
