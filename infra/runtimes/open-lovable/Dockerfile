FROM node:20-bookworm-slim

ARG OPEN_LOVABLE_SHA=69bd93bae7a9c97ef989eb70aabe6797fb3dac89

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates bash tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/open-lovable
RUN git init \
  && git remote add origin https://github.com/firecrawl/open-lovable.git \
  && git fetch --depth=1 origin "${OPEN_LOVABLE_SHA}" \
  && git checkout --detach FETCH_HEAD \
  && test "$(git rev-parse HEAD)" = "${OPEN_LOVABLE_SHA}"

RUN corepack enable \
  && corepack prepare pnpm@10.15.1 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm build

COPY infra/runtimes/common/gateway.mjs /onyx/gateway.mjs
COPY infra/runtimes/common/start-runtime.sh /onyx/start-runtime.sh
RUN chmod +x /onyx/start-runtime.sh

ENV NODE_ENV=production \
    PORT=8080 \
    UPSTREAM_HOST=127.0.0.1 \
    UPSTREAM_PORT=3000 \
    UPSTREAM_HEALTH_PATH=/ \
    SERVICE_NAME=open-lovable \
    UPSTREAM_CMD="pnpm exec next start -H 127.0.0.1 -p 3000"

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/onyx/start-runtime.sh"]
