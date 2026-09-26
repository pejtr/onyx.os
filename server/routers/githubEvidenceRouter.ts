import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  fetchGitHubEvidenceFile,
  getGitHubEvidencePolicy,
} from "../githubEvidence";
import {
  buildKnowledgeContext,
  rankKnowledgeChunks,
} from "../knowledgeFabric";

export const githubEvidenceRouter = router({
  status: adminProcedure.query(() => {
    const policy = getGitHubEvidencePolicy();
    return {
      tokenConfigured: Boolean(policy.token),
      allowedRepoCount: policy.allowedRepos.size,
      trustedRepoCount: policy.trustedRepos.size,
      readOnly: true as const,
    };
  }),

  search: adminProcedure
    .input(
      z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        path: z.string().min(1).max(1_024),
        ref: z.string().min(1).max(256).default("main"),
        query: z.string().min(1).max(4_000),
        limit: z.number().int().min(1).max(20).default(8),
      })
    )
    .query(async ({ input }) => {
      const source = await fetchGitHubEvidenceFile({
        owner: input.owner,
        repo: input.repo,
        path: input.path,
        ref: input.ref,
      });
      const hits = rankKnowledgeChunks(input.query, source.chunks, input.limit);

      return {
        source: {
          repoKey: source.repoKey,
          path: source.path,
          ref: source.ref,
          trust: source.trust,
          authenticated: source.authenticated,
          chunkCount: source.chunks.length,
        },
        hits,
        context: buildKnowledgeContext(hits),
      };
    }),
});
