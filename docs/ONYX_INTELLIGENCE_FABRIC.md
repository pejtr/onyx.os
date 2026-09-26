# ONYX Intelligence Fabric v1

Status: implementation started 2026-09-22
Branch: `feat/onyx-intelligence-fabric-v1`

## Purpose

This layer turns ONYX OS from a collection of AI features into one governed intelligence fabric shared by HERMES, 5 Brains, future OMNIA modes, Knowledge Fabric and OMNI PROFIT.

## Implemented in v1

### 1. Model Router

Central routing policy for:
- `fast`
- `expert`
- `parallel`

Configuration:
- `ONYX_MODEL_FAST`
- `ONYX_MODEL_EXPERT`
- `ONYX_MODEL_PARALLEL` (comma-separated)

Safe default remains `gemini-2.5-flash`.

The central `invokeLLM()` now resolves its default model through this router. Existing callers remain compatible.

5 Brains is explicitly marked as an `expert` workload.

### 2. Knowledge Fabric foundation

Provides:
- normalized knowledge chunks
- source provenance
- deterministic lexical retrieval
- context assembly retaining `sourceId` and `chunkId`

This is intentionally a foundation, not a claim of full vector RAG. Future providers can add embeddings/vector retrieval behind the same contracts.

#### GitHub Evidence connector

The first real Knowledge Fabric connector is a read-only GitHub evidence adapter.

Configuration:
- `ONYX_GITHUB_READ_TOKEN` — optional server-side read token
- `ONYX_GITHUB_ALLOWED_REPOS` — comma-separated repositories allowed to receive that token
- `ONYX_GITHUB_TRUSTED_REPOS` — comma-separated repositories whose evidence is marked trusted

Security invariants:
- the token is never sent to repositories outside the explicit allowlist
- public repositories can still be read anonymously
- repository owner/name, ref and file path are normalized and traversal is rejected
- reads are fixed to `api.github.com`, bounded by timeout and byte limits, and redirects are denied
- the tRPC surface is admin-only and read-only
- returned chunks use the canonical `KnowledgeChunk` provenance contract

### 3. Governed Execution

Default policy:
- read -> allow
- draft -> allow
- reversible internal write -> allow
- irreversible internal write -> human gate
- external write -> human gate
- financial -> human gate
- destructive -> human gate
- unknown risk -> deny fail-closed

This is the common policy boundary for future agents and automation workflows.

### 4. OMNI PROFIT scoring foundation

Deterministic opportunity scoring combines:
- revenue potential
- probability
- direct cost
- estimated effort
- risk
- strategic fit

The scorer is deterministic and AI-independent so rankings can be audited.

## Next slices

1. Knowledge connectors:
   - GitHub — implemented read-only v1
   - Google Drive
   - Notion
   - Gmail
   - CRM
2. Persistent Knowledge index + embeddings/vector provider.
3. HERMES knowledge-context injection.
4. Parallel model comparison executor + synthesis.
5. Governed action broker wired into existing automations/webhooks.
6. OMNI PROFIT opportunity ingestion from LeadOS and project portfolio.
7. Prompt Registry + DFY Packs.
8. Workspace/tenant policies for Agency and Enterprise layers.

## Safety invariants

- No financial mutation without human gate.
- No external write without human gate unless an explicit lower-risk policy is later approved.
- Unknown actions fail closed.
- Knowledge outputs retain provenance.
- Model provider selection is configurable server-side.
- Existing LLM callers remain backward compatible by default.
