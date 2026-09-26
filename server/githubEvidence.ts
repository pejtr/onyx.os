import type { KnowledgeChunk } from "../shared/intelligenceFabric";

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 512_000;
const DEFAULT_CHUNK_CHARS = 4_000;
const DEFAULT_CHUNK_OVERLAP = 400;

const REPO_PART = /^[A-Za-z0-9_.-]+$/;
const REF_PART = /^[A-Za-z0-9._/-]+$/;

export type GitHubEvidenceTrust = "trusted" | "unknown";

export interface GitHubEvidencePolicy {
  token: string;
  allowedRepos: Set<string>;
  trustedRepos: Set<string>;
}

export interface GitHubRepoAccess {
  repoKey: string;
  useToken: boolean;
  trust: GitHubEvidenceTrust;
}

export interface FetchGitHubEvidenceInput {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  timeoutMs?: number;
  maxBytes?: number;
  chunkChars?: number;
  chunkOverlap?: number;
}

export interface FetchGitHubEvidenceResult {
  repoKey: string;
  path: string;
  ref: string;
  trust: GitHubEvidenceTrust;
  authenticated: boolean;
  chunks: KnowledgeChunk[];
}

function parseRepoSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getGitHubEvidencePolicy(): GitHubEvidencePolicy {
  return {
    token: process.env.ONYX_GITHUB_READ_TOKEN?.trim() ?? "",
    allowedRepos: parseRepoSet(process.env.ONYX_GITHUB_ALLOWED_REPOS),
    trustedRepos: parseRepoSet(process.env.ONYX_GITHUB_TRUSTED_REPOS),
  };
}

export function normalizeRepoKey(owner: string, repo: string): string {
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim();

  if (!REPO_PART.test(normalizedOwner) || !REPO_PART.test(normalizedRepo)) {
    throw new Error("Invalid GitHub owner/repository");
  }

  return `${normalizedOwner}/${normalizedRepo}`.toLowerCase();
}

export function normalizeGitHubRef(ref: string | undefined): string {
  const normalized = (ref ?? "main").trim();
  if (!normalized || !REF_PART.test(normalized) || normalized.includes("..")) {
    throw new Error("Invalid GitHub ref");
  }
  return normalized;
}

export function normalizeGitHubPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) throw new Error("GitHub path is required");

  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0")
    )
  ) {
    throw new Error("Invalid GitHub path");
  }

  return segments.join("/");
}

export function resolveGitHubRepoAccess(
  owner: string,
  repo: string,
  policy: GitHubEvidencePolicy = getGitHubEvidencePolicy()
): GitHubRepoAccess {
  const repoKey = normalizeRepoKey(owner, repo);
  const useToken = Boolean(policy.token && policy.allowedRepos.has(repoKey));
  const trust: GitHubEvidenceTrust = policy.trustedRepos.has(repoKey)
    ? "trusted"
    : "unknown";

  return { repoKey, useToken, trust };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function buildContentsUrl(
  owner: string,
  repo: string,
  path: string,
  ref: string
): string {
  return `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
}

export function chunkGitHubText(
  text: string,
  options: {
    maxChars?: number;
    overlap?: number;
  } = {}
): Array<{ text: string; start: number; end: number }> {
  const maxChars = Math.max(500, options.maxChars ?? DEFAULT_CHUNK_CHARS);
  const overlap = Math.max(
    0,
    Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, maxChars - 1)
  );

  if (text.length <= maxChars) {
    return [{ text, start: 0, end: text.length }];
  }

  const chunks: Array<{ text: string; start: number; end: number }> = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(text.length, start + maxChars);

    if (end < text.length) {
      const newline = text.lastIndexOf("\n", end);
      if (newline > start + Math.floor(maxChars * 0.55)) {
        end = newline + 1;
      }
    }

    chunks.push({
      text: text.slice(start, end),
      start,
      end,
    });

    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

export async function fetchGitHubEvidenceFile(
  input: FetchGitHubEvidenceInput,
  dependencies: {
    fetchImpl?: typeof fetch;
    now?: () => Date;
    policy?: GitHubEvidencePolicy;
  } = {}
): Promise<FetchGitHubEvidenceResult> {
  const owner = input.owner.trim();
  const repo = input.repo.trim();
  const path = normalizeGitHubPath(input.path);
  const ref = normalizeGitHubRef(input.ref);
  const policy = dependencies.policy ?? getGitHubEvidencePolicy();
  const access = resolveGitHubRepoAccess(owner, repo, policy);

  const timeoutMs = Math.max(1_000, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maxBytes = Math.max(1_024, input.maxBytes ?? DEFAULT_MAX_BYTES);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    accept: "application/vnd.github.raw+json",
    "user-agent": "ONYX-Knowledge-Fabric/1.0",
    "x-github-api-version": "2022-11-28",
  };

  if (access.useToken) {
    headers.authorization = `Bearer ${policy.token}`;
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(buildContentsUrl(owner, repo, path, ref), {
      method: "GET",
      headers,
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub evidence read failed: HTTP ${response.status}`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error("GitHub evidence file exceeds size limit");
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error("GitHub evidence file exceeds size limit");
    }

    const capturedAt = (dependencies.now ?? (() => new Date()))().toISOString();
    const pieces = chunkGitHubText(text, {
      maxChars: input.chunkChars,
      overlap: input.chunkOverlap,
    });

    const chunks: KnowledgeChunk[] = pieces.map((piece, index) => ({
      chunkId: `github:${access.repoKey}:${path}:${ref}:${index}`,
      source: {
        sourceId: `github:${access.repoKey}`,
        kind: "github",
        title: path.split("/").at(-1) ?? path,
        uri: `https://github.com/${access.repoKey}/blob/${encodeURIComponent(ref)}/${encodePath(path)}`,
        version: ref,
        capturedAt,
      },
      text: piece.text,
      metadata: {
        trust: access.trust,
        authenticated: access.useToken,
        repo: access.repoKey,
        path,
        ref,
        start: piece.start,
        end: piece.end,
      },
    }));

    return {
      repoKey: access.repoKey,
      path,
      ref,
      trust: access.trust,
      authenticated: access.useToken,
      chunks,
    };
  } finally {
    clearTimeout(timeout);
  }
}
