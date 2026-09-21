import { z } from "zod";

import { protectedProcedure, router } from "../_core/trpc";
import { getKnowledgeArticles } from "../db";
import { evaluateGovernedAction } from "../ai/governedExecution";
import { buildEvidenceContext } from "../ai/knowledgeFabric";
import { resolveModelPlan } from "../ai/modelRouter";
import {
  rankProfitOpportunities,
  scoreProfitOpportunity,
} from "../ai/profitScorer";

const modeSchema = z.enum(["FAST", "EXPERT", "PARALLEL"]);
const taskSchema = z.enum([
  "classification",
  "chat",
  "research",
  "code",
  "synthesis",
  "extraction",
  "planning",
]);

const provenanceSchema = z.object({
  sourceId: z.string().min(1).max(256),
  sourceKind: z.enum([
    "github",
    "google-drive",
    "notion",
    "gmail",
    "file",
    "web",
    "crm",
    "manual",
  ]),
  documentId: z.string().min(1).max(512),
  chunkId: z.string().min(1).max(256),
  title: z.string().max(512).optional(),
  uri: z.string().max(2048).optional(),
  version: z.string().max(256).optional(),
  capturedAt: z.string().min(1).max(128),
});

const knowledgeChunkSchema = z.object({
  id: z.string().min(1).max(256),
  text: z.string().min(1).max(12_000),
  trust: z.enum(["trusted", "untrusted", "unknown"]),
  provenance: provenanceSchema,
});

const profitOpportunitySchema = z.object({
  id: z.string().min(1).max(256),
  expectedRevenue: z.number().finite(),
  probability: z.number().finite(),
  grossMargin: z.number().finite(),
  hoursRequired: z.number().finite(),
  cashCost: z.number().finite(),
  risk: z.number().finite(),
  timeToRevenueDays: z.number().finite(),
  currency: z.string().min(3).max(8).optional(),
});

export const aiFabricRouter = router({
  modelPlan: protectedProcedure
    .input(
      z.object({
        mode: modeSchema,
        task: taskSchema,
      })
    )
    .query(({ input }) => resolveModelPlan(input.mode, input.task)),

  evaluateAction: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1).max(256),
        risk: z.enum(["READ", "EXTERNAL_WRITE", "FINANCIAL", "DESTRUCTIVE"]),
        description: z.string().min(1).max(2_000),
        targetVerified: z.boolean(),
        requiresSecret: z.boolean().optional(),
      })
    )
    .query(({ input }) => evaluateGovernedAction(input)),

  scoreOpportunity: protectedProcedure
    .input(profitOpportunitySchema)
    .query(({ input }) => scoreProfitOpportunity(input)),

  rankOpportunities: protectedProcedure
    .input(z.object({ opportunities: z.array(profitOpportunitySchema).max(100) }))
    .query(({ input }) => rankProfitOpportunities(input.opportunities)),

  knowledgePreview: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(4_000),
        chunks: z.array(knowledgeChunkSchema).max(100),
        limit: z.number().int().min(1).max(20).default(8),
      })
    )
    .query(({ input }) =>
      buildEvidenceContext(input.query, input.chunks, input.limit)
    ),

  knowledgeSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(4_000),
        limit: z.number().int().min(1).max(20).default(8),
      })
    )
    .query(async ({ input }) => {
      const articles = await getKnowledgeArticles();
      const chunks = articles.map((article) => ({
        id: `knowledge-article-${article.id}`,
        text: `${article.title}\n\n${article.content}`,
        trust: "unknown" as const,
        provenance: {
          sourceId: "onyx:knowledge_articles",
          sourceKind: "manual" as const,
          documentId: `knowledge_articles:${article.id}`,
          chunkId: `article:${article.id}`,
          title: article.title,
          version: "legacy-v1",
          capturedAt: article.createdAt.toISOString(),
        },
      }));

      return buildEvidenceContext(input.query, chunks, input.limit);
    }),
});
