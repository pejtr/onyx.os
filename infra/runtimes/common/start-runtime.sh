#!/usr/bin/env bash
set -euo pipefail

: "${UPSTREAM_CMD:?UPSTREAM_CMD is required}"

terminate() {
  set +e
  [[ -n "${UPSTREAM_PID:-}" ]] && kill -TERM "${UPSTREAM_PID}" 2>/dev/null
  [[ -n "${GATEWAY_PID:-}" ]] && kill -TERM "${GATEWAY_PID}" 2>/dev/null
}
trap terminate INT TERM EXIT

bash -lc "${UPSTREAM_CMD}" &
UPSTREAM_PID=$!

node /onyx/gateway.mjs &
GATEWAY_PID=$!

set +e
wait -n "${UPSTREAM_PID}" "${GATEWAY_PID}"
STATUS=$?
set -e

terminate
wait "${UPSTREAM_PID}" 2>/dev/null || true
wait "${GATEWAY_PID}" 2>/dev/null || true
exit "${STATUS}"
