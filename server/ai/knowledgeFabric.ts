import type { KnowledgeChunk } from "../../shared/aiFabric";

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("cs-CZ")
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2)
  );
}

export interface RankedKnowledgeChunk {
  chunk: KnowledgeChunk;
  score: number;
}

export function rankKnowledgeChunks(
  query: string,
  chunks: KnowledgeChunk[],
  limit = 8
): RankedKnowledgeChunk[] {
  const queryTokens = tokens(query);
  if (queryTokens.size === 0 || limit <= 0) return [];

  return chunks
    .map((chunk) => {
      const chunkTokens = tokens(chunk.text);
      let overlap = 0;
      for (const token of queryTokens) {
        if (chunkTokens.has(token)) overlap += 1;
      }

      const coverage = overlap / queryTokens.size;
      if (coverage === 0) {
        return { chunk, score: 0 };
      }

      const trustBoost =
        chunk.trust === "trusted" ? 0.08 : chunk.trust === "untrusted" ? -0.08 : 0;

      return {
        chunk,
        score: Math.max(0.001, coverage + trustBoost),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
    .slice(0, limit);
}

export interface EvidenceContext {
  context: string;
  evidence: Array<{
    chunkId: string;
    sourceId: string;
    documentId: string;
    title?: string;
    uri?: string;
    trust: KnowledgeChunk["trust"];
    score: number;
  }>;
}

export function buildEvidenceContext(
  query: string,
  chunks: KnowledgeChunk[],
  limit = 8
): EvidenceContext {
  const ranked = rankKnowledgeChunks(query, chunks, limit);

  const evidence = ranked.map(({ chunk, score }) => ({
    chunkId: chunk.provenance.chunkId,
    sourceId: chunk.provenance.sourceId,
    documentId: chunk.provenance.documentId,
    title: chunk.provenance.title,
    uri: chunk.provenance.uri,
    trust: chunk.trust,
    score,
  }));

  const context = ranked
    .map(
      ({ chunk }, index) =>
        `[EVIDENCE ${index + 1} | source=${chunk.provenance.sourceId} | document=${chunk.provenance.documentId} | chunk=${chunk.provenance.chunkId} | trust=${chunk.trust}]\n${chunk.text}\n[/EVIDENCE ${index + 1}]`
    )
    .join("\n\n");

  return { context, evidence };
}
