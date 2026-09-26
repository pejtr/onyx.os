FROM node:22-bookworm-slim

ARG MOTION_ANYTHING_SHA=b016900d9ee92fc2d3e4dc520359cc8999d2ed4e
ARG HYPERFRAMES_VERSION=0.8.78

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates bash tini ffmpeg chromium \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/motion-anything
RUN git init \
  && git remote add origin https://github.com/nexu-io/motion-anything.git \
  && git fetch --depth=1 origin "${MOTION_ANYTHING_SHA}" \
  && git checkout --detach FETCH_HEAD \
  && test "$(git rev-parse HEAD)" = "${MOTION_ANYTHING_SHA}"

RUN npm install --global "hyperframes@${HYPERFRAMES_VERSION}"

RUN mkdir -p /data/projects \
  && rm -rf /opt/motion-anything/app/projects \
  && ln -s /data/projects /opt/motion-anything/app/projects

COPY infra/runtimes/common/gateway.mjs /onyx/gateway.mjs
COPY infra/runtimes/common/start-runtime.sh /onyx/start-runtime.sh
COPY infra/runtimes/motion-anything/bootstrap-byok.mjs /onyx/bootstrap-byok.mjs
RUN chmod +x /onyx/start-runtime.sh

ENV NODE_ENV=production \
    PORT=8080 \
    UPSTREAM_HOST=127.0.0.1 \
    UPSTREAM_PORT=4321 \
    UPSTREAM_HEALTH_PATH=/api/projects \
    SERVICE_NAME=motion-anything \
    HYPERFRAMES_BIN=/usr/local/bin/hyperframes \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CONTAINER=true \
    UPSTREAM_CMD="node /onyx/bootstrap-byok.mjs && node /opt/motion-anything/cli/bin/motion.js serve 4321"

VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/onyx/start-runtime.sh"]
