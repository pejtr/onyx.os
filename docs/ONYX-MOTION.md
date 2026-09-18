# ONYX WEBY — Motion & Video Layer

## Purpose

ONYX Motion is the motion orchestration layer for ONYX WEBY.

It keeps ONYX as the authority and treats third-party motion/video projects as replaceable adapters:

- **motion-anything** — live web/component motion, motion taste, recipe routing, HTML artifact generation, HyperFrames export.
- **html-video** — multi-scene storyboard/video project and MP4 export bridge.
- **OMNI VIDEO** — downstream distribution, transcoding and publishing authority.

Neither upstream project becomes a new OS, cockpit, or source of tenant authority.

## Capability surface

- `web.motion.plan`
- `web.motion.apply`
- `web.motion.preview`
- `web.motion.export`
- `web.motion.fromReference`
- `web.video.fromPage`
- `web.video.fromComponent`
- `web.video.fromUrl`
- `web.video.render`

The first capability is available from the local deterministic ONYX planner even when all external adapters are offline.

## Restraint gates

Every ONYX plan enforces the initial motion quality gates:

- maximum 1 attention-grabbing moment per viewport;
- maximum 1 ambient loop per viewport;
- maximum 3 simultaneous entrance animations, with later entrances staggered;
- transform/opacity-only CSS for generated movement;
- `prefers-reduced-motion` fallback in generated CSS;
- CTA emphasis is interaction-triggered rather than autoplay.

These are product gates, not merely style suggestions.

## Motion profiles

| ONYX | motion-anything profile | Meaning |
| --- | --- | --- |
| SUBTLE | subtle | clarity-first, minimal motion |
| PRODUCT | lively | confident product motion with restraint |
| CINEMATIC | cinematic | fewer, larger brand/launch moments |

## Server-only adapters

Configure adapter URLs only on the server:

```env
ONYX_MOTION_ANYTHING_URL=http://127.0.0.1:4399
ONYX_HTML_VIDEO_URL=http://127.0.0.1:3071
```

Do not expose these values as `VITE_*` variables and do not proxy the upstream studios directly to public clients.

The tRPC router intentionally exposes only adapter health state, not the configured internal URL.

## motion-anything endpoints used

The adapter currently uses the upstream runtime endpoints verified from `nexu-io/motion-anything`:

- `GET /api/projects` — health/probe
- `POST /api/motion-suggest` — component motion suggestion
- `POST /api/generate` — self-contained animated HTML artifact
- `POST /api/edit` — edit an existing artifact
- `POST /api/hf-render` — HyperFrames HD MP4 export

ONYX maps PRODUCT to upstream `lively`, rather than inventing a new upstream profile.

## html-video endpoints used

The adapter currently uses the upstream Studio API verified from `nexu-io/html-video`:

- `GET /api/projects` — health/probe
- `POST /api/projects` — create a video/storyboard project
- `POST /api/projects/:id/export` — blocking MP4 export

More granular storyboard generation can be added behind the same ONYX capability surface without changing clients.

## Control surface

Authenticated users can open:

```
/web-motion
```

The Motion Lab shows:

- ONYX local planner status;
- motion-anything adapter status;
- html-video adapter status;
- SUBTLE / PRODUCT / CINEMATIC profile selection;
- deterministic POC motion planning;
- dependency-free CSS export;
- optional artifact generation when motion-anything is connected.

## License / provenance

No upstream source code is vendored by this integration.

- `nexu-io/motion-anything` — Apache-2.0; upstream also maintains `ATTRIBUTION.md` for third-party recipe provenance.
- `nexu-io/html-video` — Apache-2.0.

If ONYX later vendors recipes, templates, icons, shaders, or other upstream artifacts, copy and preserve all applicable license/attribution notices and review the provenance of each imported artifact.

## Next POC

Use one real ONYX WEBY landing page and collect evidence for:

1. baseline and animated performance;
2. CLS;
3. reduced-motion behavior;
4. motion budget compliance;
5. desktop + mobile rendering;
6. 15-second 16:9 and 9:16 MP4 export;
7. OMNI VIDEO handoff.

Do not deploy heavy WebGL or bulk-import the upstream recipe library before this evidence gate closes.
