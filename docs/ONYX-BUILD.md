# ONYX BUILD — Open Lovable runtime

ONYX BUILD keeps generation isolated from Git, deploy, DNS and production state.

## Runtime topology

```
ONYX OS
  -> ONYX BUILD provider registry
     -> Open Lovable runtime (authenticated endpoint)
        -> Firecrawl ingest
        -> Vercel Sandbox or E2B
        -> configured LLM provider
        -> generated React application
        -> npm run build
        -> sandbox smoke/health check
```

The Open Lovable service owns its Firecrawl, LLM and sandbox credentials. ONYX OS does not proxy or expose those provider secrets.

## ONYX OS environment

```env
ONYX_OPEN_LOVABLE_URL=https://open-lovable.internal.example
ONYX_OPEN_LOVABLE_TOKEN=replace-with-proxy-bearer-token
# Optional model override; omitted means Open Lovable's configured default.
ONYX_OPEN_LOVABLE_MODEL=
# 10s..600s, default 180000.
ONYX_OPEN_LOVABLE_TIMEOUT_MS=180000
```

For a remote production runtime, put Open Lovable behind a proxy that validates `ONYX_OPEN_LOVABLE_TOKEN`. ONYX rejects insecure remote HTTP runtime URLs in production. Loopback HTTP is allowed for a same-host sidecar.

## Governance

- source URL ingest: sandbox-only
- generated files: sandbox-only
- package install/build commands: sandbox-only
- production touched: always `false`
- Git writes: `external_write` -> HUMAN GATE
- deploy/DNS/payment actions: outside ONYX BUILD runtime and remain separately governed

## Verification evidence

`onyxBuild.executeFromUrl` returns:

- sandbox ID and preview URL
- files created/updated
- install/apply result
- `npm run build` result
- sandbox health/smoke result
- explicit errors
- `humanGateRequiredForGitWrite: true`

A build is not reported as completed unless apply, build and smoke checks pass.
