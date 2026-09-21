# ONYX AI Fabric v1

Status: implementation branch
Branch: `feat/onyx-ai-fabric-v1`

## Why

This layer turns the useful product patterns found in multi-model AI suites into ONYX-native primitives instead of introducing another monolithic application.

The first release is intentionally conservative:

- no new external provider is assumed to exist,
- no autonomous external write is enabled,
- no financial action is auto-approved,
- no legacy knowledge is silently marked as verified,
- existing HERA/HERMES behaviour keeps the current LLM as the default.

## Architecture

```text
                       OMNIA / ONYX OS
                             |
          +------------------+------------------+
          |                  |                  |
     MODEL ROUTER       KNOWLEDGE FABRIC   GOVERNED EXECUTION
          |                  |                  |
     FAST / EXPERT      provenance-aware    policy decision
       / PARALLEL         evidence packs    AUTO / GATE / DENY
          |                  |                  |
          +------------------+------------------+
                             |
                         HERA / HERMES
                             |
          +------------------+------------------+
          |                                     |
      LEADOS / CRM                         OMNIFORGE / DEVO
          |
      OMNI PROFIT
```

## 1. Model Router

File: `server/ai/modelRouter.ts`

Modes:

- `FAST` â€” low-latency lane for classification/extraction.
- `EXPERT` â€” primary reasoning/chat lane.
- `PARALLEL` â€” invokes distinct explicitly configured models in parallel.

Current default remains:

`gemini-2.5-flash`

Optional configuration:

- `ONYX_DEFAULT_MODEL`
- `ONYX_FAST_MODEL`
- `ONYX_EXPERT_MODEL`
- `ONYX_SECONDARY_MODEL`

If no environment variables are provided, ONYX does not pretend to have multiple models. PARALLEL de-duplicates to the models that actually exist in configuration.

HERA integration:

- intent classification -> FAST
- primary response -> EXPERT

HERMES integration:

- intent classification -> FAST
- primary response -> EXPERT

Mission execution remains on the legacy transport in v1 to limit blast radius.

## 2. Knowledge Fabric

Files:

- `shared/aiFabric.ts`
- `server/ai/knowledgeFabric.ts`

Every chunk carries:

- source kind,
- source id,
- document id,
- chunk id,
- capture timestamp,
- optional title/URI/version,
- trust state.

Trust states:

- `trusted`
- `untrusted`
- `unknown`

Existing `knowledge_articles` are exposed through `aiFabric.knowledgeSearch` with `unknown` trust because the legacy table has no evidence/verification metadata.

The evidence pack uses explicit boundaries:

```text
[EVIDENCE 1 | source=... | document=... | chunk=... | trust=...]
...
[/EVIDENCE 1]
```

This is the first step toward GitHub / Drive / Notion / Gmail / file provenance without collapsing all knowledge into an untraceable prompt.

## 3. Governed Execution

File: `server/ai/governedExecution.ts`

Default policy:

| Risk | Default |
|---|---|
| verified READ | AUTO |
| unverified target | DENY |
| EXTERNAL_WRITE | HUMAN_GATE |
| FINANCIAL | HUMAN_GATE |
| DESTRUCTIVE | DENY |

Destructive actions may only become human-gated through an explicit policy override. They never become automatic in this layer.

## 4. OMNI PROFIT scorer

File: `server/ai/profitScorer.ts`

The scorer is deterministic. It does not ask an LLM to invent a priority.

Inputs:

- expected revenue,
- probability,
- gross margin,
- hours required,
- cash cost,
- risk,
- time to revenue.

Core outputs:

- expected gross profit,
- speed factor,
- risk factor,
- priority index.

## 5. Read-only API surface

Router: `server/routers/aiFabric.ts`

Protected endpoints:

- `aiFabric.modelPlan`
- `aiFabric.evaluateAction`
- `aiFabric.scoreOpportunity`
- `aiFabric.rankOpportunities`
- `aiFabric.knowledgePreview`
- `aiFabric.knowledgeSearch`

All endpoints in v1 are read-only / pure computation.

## Next integrations

P0 follow-up:

1. GitHub evidence adapter.
2. Google Drive / Docs evidence adapter.
3. Notion evidence adapter.
4. Gmail evidence adapter for explicitly scoped project knowledge.
5. Prompt-injection treatment for untrusted retrieved documents.
6. Persisted model-route telemetry and cost/latency measurements.
7. OMNI PROFIT adapter for LEADOS opportunities.
8. Governed action envelope around existing write-capable integrations.

P1:

- research studio UI,
- code studio -> DEVO,
- design studio -> ONYX Design Fabric / OMNIFORGE,
- prompt registry,
- reusable DFY packs,
- client/workspace tenancy.

## Non-goals for v1

- No ClaudeVerse dependency.
- No reseller/white-label implementation.
- No â€śunlimited AIâ€ť promise.
- No automatic payment, publishing, deletion or campaign mutation.
- No assumption that an environment-configured model is available until runtime verifies it.
