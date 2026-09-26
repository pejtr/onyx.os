# ONYX Runtime Pack on Cloudflare Containers

Status: deployment layer prepared; **not deployed by this change**.

## Why Cloudflare Containers

Cloudflare Containers can build local Dockerfiles during `wrangler deploy`, attach each image to a Durable Object class, and pass Worker Secrets into the container environment.

ONYX uses one Worker as a private runtime router for three isolated container classes:

```
ONYX OS
  |
  +-- /open-lovable/*    -> OpenLovableContainer
  +-- /motion-anything/* -> MotionAnythingContainer
  +-- /html-video/*      -> HtmlVideoContainer
```

Each container still has the inner ONYX bearer gateway. Cloudflare routing does not replace runtime authentication.

## Cost / blast-radius defaults

POC configuration deliberately caps every service at `max_instances: 1`.

- Open Lovable: `basic`
- motion-anything: `standard-1`
- html-video: `standard-1`

Change instance classes only after measured build/render evidence.

## Container persistence boundary

Cloudflare Container local disk is ephemeral. A sleeping/restarted/replaced instance can start with a fresh filesystem.

Therefore:

- Open Lovable is suitable immediately because its generated application runs in an external sandbox provider.
- motion-anything and html-video are suitable for the first evidence POC, but their local project history is **not yet durable** on Cloudflare.
- Production Motion/video persistence requires an explicit second slice, preferably an R2 FUSE mount or an application-level R2 persistence adapter.

Do not describe Cloudflare-local `/data` as durable until that slice is implemented and verified.

## Worker URL mapping

If the Worker is available at:

```
https://onyx-runtime-router.<account>.workers.dev
```

configure ONYX OS with:

```env
ONYX_OPEN_LOVABLE_URL=https://onyx-runtime-router.<account>.workers.dev/open-lovable
ONYX_OPEN_LOVABLE_TOKEN=<OPEN_LOVABLE runtime token>

ONYX_MOTION_ANYTHING_URL=https://onyx-runtime-router.<account>.workers.dev/motion-anything
ONYX_MOTION_ANYTHING_TOKEN=<MOTION runtime token>
ONYX_MOTION_DEFAULT_CLI=byok

ONYX_HTML_VIDEO_URL=https://onyx-runtime-router.<account>.workers.dev/html-video
ONYX_HTML_VIDEO_TOKEN=<HTML_VIDEO runtime token>
```

The ONYX adapters append their normal `/api/*` paths; the Worker removes the service prefix before forwarding into the container.

## Secrets

Use Cloudflare Worker Secrets, not plaintext `vars`, for API keys and runtime tokens.

Minimum practical POC:

### Open Lovable
- `ONYX_OPEN_LOVABLE_TOKEN`
- `FIRECRAWL_API_KEY`
- one model-provider key
- `E2B_API_KEY` when `SANDBOX_PROVIDER=e2b`

### motion-anything
- `ONYX_MOTION_ANYTHING_TOKEN`
- `MOTION_BYOK_API_KEY`
- optional `MOTION_BYOK_PROVIDER` and `MOTION_BYOK_MODEL`

### html-video
- `ONYX_HTML_VIDEO_TOKEN`
- `HTML_VIDEO_ANTHROPIC_API_KEY` or `HTML_VIDEO_ANTHROPIC_AUTH_TOKEN`

Example secret command:

```bash
cd infra/cloudflare/onyx-runtimes
npx wrangler secret put ONYX_OPEN_LOVABLE_TOKEN
```

Repeat only for the secrets actually used by the selected providers.

## Local validation

```bash
cd infra/cloudflare/onyx-runtimes
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

This requires a Docker-compatible engine because local Container images are built from Dockerfiles.

## Deploy gate

Production deployment is intentionally not automated in this PR.

Before `npm run deploy`:

1. Docker/build environment is available or Workers Builds is configured.
2. Worker Secrets exist.
3. Cloudflare Containers entitlement/limits are confirmed.
4. First deploy is treated as infrastructure write and requires human approval.
5. No custom DNS route is attached until workers.dev POC health + end-to-end evidence is green.

## POC evidence sequence

1. Deploy only to the default `workers.dev` hostname.
2. Verify `GET /__onyx/health`.
3. Verify bearer-authenticated `/open-lovable/api/*`, `/motion-anything/api/*`, and `/html-video/api/*`.
4. Run one Open Lovable URL -> sandbox build -> preview.
5. Run one Motion artifact generation.
6. Run one html-video 15-second MP4 export.
7. Record runtime IDs, timings, errors and outputs.
8. Only then decide persistence and custom-domain/DNS work.
