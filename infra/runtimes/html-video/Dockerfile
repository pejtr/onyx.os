FROM node:22-bookworm-slim

ARG HTML_VIDEO_SHA=c414ecc07f795add03807d5d9ce4baefd807cea2

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates bash tini ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/html-video
RUN git init \
  && git remote add origin https://github.com/nexu-io/html-video.git \
  && git fetch --depth=1 origin "${HTML_VIDEO_SHA}" \
  && git checkout --detach FETCH_HEAD \
  && test "$(git rev-parse HEAD)" = "${HTML_VIDEO_SHA}"

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN corepack enable \
  && corepack prepare pnpm@9.15.0 --activate \
  && pnpm install --no-frozen-lockfile \
  && pnpm --filter @html-video/adapter-hyperframes exec playwright install --with-deps chromium \
  && pnpm -r build

RUN mkdir -p /data/html-video

COPY infra/runtimes/common/gateway.mjs /onyx/gateway.mjs
COPY infra/runtimes/common/start-runtime.sh /onyx/start-runtime.sh
RUN chmod +x /onyx/start-runtime.sh

ENV NODE_ENV=production \
    PORT=8080 \
    UPSTREAM_HOST=127.0.0.1 \
    UPSTREAM_PORT=3071 \
    UPSTREAM_HEALTH_PATH=/api/projects \
    SERVICE_NAME=html-video \
    UPSTREAM_CMD="node /opt/html-video/packages/cli/dist/bin.js --cwd /data/html-video studio --port 3071"

VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/onyx/start-runtime.sh"]
