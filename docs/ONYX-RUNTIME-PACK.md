# ONYX Runtime Pack v1

## Purpose

The runtime pack turns the already-merged ONYX BUILD and ONYX Motion adapter code into deployable, isolated runtime services without coupling ONYX OS to a single hosting provider.

It contains three separate OCI workloads:

| Service | Upstream | Runtime shape | Public gateway |
| --- | --- | --- | --- |
| Open Lovable | `firecrawl/open-lovable` | Next.js + external sandbox provider | bearer-auth API only |
| motion-anything | `nexu-io/motion-anything` | persistent Node worker + HyperFrames/Chromium/ffmpeg | bearer-auth API only |
| html-video | `nexu-io/html-video` | persistent Node worker + Playwright Chromium/ffmpeg | bearer-auth API only |

The upstream studios bind to loopback. A small ONYX gateway listens on the container port and exposes only `/api/*` after bearer authentication.

## Pinned upstream revisions

- Open Lovable: `69bd93bae7a9c97ef989eb70aabe6797fb3dac89`
- motion-anything: `b016900d9ee92fc2d3e4dc520359cc8999d2ed4e`
- html-video: `c414ecc07f795add03807d5d9ce4baefd807cea2`
- HyperFrames CLI inside motion-anything: `0.8.78`

Open Lovable has a lockfile and is installed with `--frozen-lockfile`.
motion-anything has no runtime npm dependency graph beyond the explicitly pinned HyperFrames CLI.
**Evidence gap:** html-video currently ships no npm/pnpm/yarn/bun lockfile. Its source revision is pinned, but transitive dependency resolution is not fully reproducible until ONYX records a reviewed lock or upstream adds one.

## Gateway / Zero Trust

Every container requires a unique `ONYX_RUNTIME_TOKEN` with at least 32 characters.

The gateway:

- listens on `0.0.0.0:8080`;
- permits only `/api/*`;
- requires `Authorization: Bearer <token>`;
- strips the gateway Authorization header before forwarding upstream;
- streams responses, including SSE;
- exposes only a minimal unauthenticated `GET /__onyx/health`;
- never exposes the upstream studio UI.

Tokens are runtime secrets. They are never baked into images and never sent to the browser.

## ONYX OS environment

When the runtimes are reachable over TLS:

```env
ONYX_OPEN_LOVABLE_URL=https://open-lovable-runtime.example
ONYX_OPEN_LOVABLE_TOKEN=<same secret as that runtime gateway>

ONYX_MOTION_ANYTHING_URL=https://motion-runtime.example
ONYX_MOTION_ANYTHING_TOKEN=<same secret as that runtime gateway>
ONYX_MOTION_DEFAULT_CLI=byok

ONYX_HTML_VIDEO_URL=https://html-video-runtime.example
ONYX_HTML_VIDEO_TOKEN=<same secret as that runtime gateway>
```

For same-host/local testing, loopback HTTP remains allowed.

## Runtime provider secrets

### Open Lovable

Required:

- `FIRECRAWL_API_KEY`
- at least one supported model-provider key

Sandbox:

- `SANDBOX_PROVIDER=e2b` + `E2B_API_KEY`, or
- Vercel sandbox credentials (`VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`)

### motion-anything

The container defaults ONYX calls to `cli=byok`, avoiding dependency on a logged-in desktop CLI.

Configure:

- `MOTION_BYOK_PROVIDER=anthropic|openai|google`
- `MOTION_BYOK_API_KEY`
- optional `MOTION_BYOK_MODEL`

The key is materialized into the upstream gitignored BYOK config at container start and is never logged.

Generated projects persist under the `/data` volume.

### html-video

The upstream runtime supports Anthropic-compatible direct API auth through environment variables:

- `ANTHROPIC_API_KEY`, or
- `ANTHROPIC_AUTH_TOKEN`
- optional `ANTHROPIC_BASE_URL`

The compose example maps separate `HTML_VIDEO_*` host variables into those upstream names.

Project/render state persists under `/data`.

## Local POC

Copy the example env file and fill real secrets locally:

```bash
cp infra/runtimes/.env.example infra/runtimes/.env
docker compose --env-file infra/runtimes/.env -f infra/runtimes/docker-compose.yml up --build
```

Local gateway addresses:

- Open Lovable: `http://127.0.0.1:18081`
- motion-anything: `http://127.0.0.1:18082`
- html-video: `http://127.0.0.1:18083`

Health example:

```bash
curl http://127.0.0.1:18082/__onyx/health
curl -H "Authorization: Bearer $ONYX_MOTION_ANYTHING_TOKEN" \
  http://127.0.0.1:18082/api/projects
```

A green process health endpoint means the upstream process is reachable. It does **not** prove provider credentials or a full render/build path. Capability readiness is established only by the end-to-end POC.

## First end-to-end evidence run

1. Open Lovable: public URL -> Firecrawl -> isolated sandbox -> generated application -> `npm run build` -> preview.
2. motion-anything: ONYX Motion brief -> BYOK generation -> project artifact.
3. html-video: public page -> grounded storyboard -> MP4 export.
4. Record sandbox/project IDs, output paths, build/render status and timings.
5. No Git write or production deploy happens automatically; those remain separate human gates.

## Deployment target

These images are generic OCI workloads. The runtime pack intentionally does not encode production DNS or a provider-specific deployment in this change.

Open Lovable can run in a normal cloud application environment. motion-anything and html-video need a persistent/container-style runtime because they use filesystem state, child processes, Chromium and ffmpeg.

Production deployment, secrets and DNS remain HUMAN GATE actions.
