import type { KnowledgeChunk, KnowledgeHit } from "../shared/intelligenceFabric";

const normalizeTerms = (value: string): string[] =>
  value
    .toLocaleLowerCase("cs")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

export function rankKnowledgeChunks(
  query: string,
  chunks: KnowledgeChunk[],
  limit = 8
): KnowledgeHit[] {
  const queryTerms = unique(normalizeTerms(query));
  if (queryTerms.length === 0 || limit <= 0) return [];

  return chunks
    .map((chunk) => {
      const haystack = new Set(normalizeTerms(chunk.text));
      const matchedTerms = queryTerms.filter((term) => haystack.has(term));
      const coverage = matchedTerms.length / queryTerms.length;
      const specificity = matchedTerms.length / Math.max(1, haystack.size);
      const score = Number((coverage * 0.85 + specificity * 0.15).toFixed(6));
      return { chunk, score, matchedTerms };
    })
    .filter((hit) => hit.matchedTerms.length > 0)
    .sort((a, b) => b.score - a.score || a.chunk.chunkId.localeCompare(b.chunk.chunkId))
    .slice(0, limit);
}

export function buildKnowledgeContext(hits: KnowledgeHit[]): string {
  return hits
    .map(
      (hit, index) =>
        `[K${index + 1}] ${hit.chunk.source.title} (${hit.chunk.source.kind})\n` +
        `sourceId=${hit.chunk.source.sourceId} chunkId=${hit.chunk.chunkId}\n` +
        `${hit.chunk.text}`
    )
    .join("\n\n");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
