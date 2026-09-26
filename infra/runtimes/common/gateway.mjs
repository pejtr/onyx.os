import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const token = process.env.ONYX_RUNTIME_TOKEN?.trim() ?? "";
const serviceName = process.env.SERVICE_NAME?.trim() || "onyx-runtime";
const upstreamHost = process.env.UPSTREAM_HOST?.trim() || "127.0.0.1";
const upstreamPort = Number(process.env.UPSTREAM_PORT || "3000");
const healthPath = process.env.UPSTREAM_HEALTH_PATH?.trim() || "/";
const port = Number(process.env.PORT || "8080");

if (token.length < 32) {
  throw new Error("ONYX_RUNTIME_TOKEN must be configured with at least 32 characters.");
}
if (!Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535) {
  throw new Error("UPSTREAM_PORT is invalid.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT is invalid.");
}

function constantTimeEqual(actual, expected) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req) {
  const value = typeof req.headers.authorization === "string"
    ? req.headers.authorization
    : "";
  return constantTimeEqual(value, `Bearer ${token}`);
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function probeUpstream() {
  return new Promise((resolve) => {
    const request = http.request(
      {
        host: upstreamHost,
        port: upstreamPort,
        path: healthPath,
        method: "GET",
        headers: {
          "user-agent": "ONYX-Runtime-Gateway/1.0",
        },
      },
      (response) => {
        response.resume();
        resolve({
          ok: Boolean(response.statusCode && response.statusCode < 500),
          status: response.statusCode ?? 0,
        });
      },
    );

    request.setTimeout(3_000, () => request.destroy(new Error("health timeout")));
    request.on("error", () => resolve({ ok: false, status: 0 }));
    request.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    return json(res, 400, { ok: false });
  }

  if (req.url === "/__onyx/health" && req.method === "GET") {
    const health = await probeUpstream();
    return json(res, health.ok ? 200 : 503, {
      ok: health.ok,
      service: serviceName,
      upstreamStatus: health.status,
    });
  }

  if (!req.url.startsWith("/api/")) {
    return json(res, 404, { error: "NOT_FOUND" });
  }

  if (!authorized(req)) {
    return json(res, 401, { error: "UNAUTHORIZED" });
  }

  const headers = { ...req.headers };
  delete headers.authorization;
  delete headers.host;
  delete headers.connection;
  headers.host = `${upstreamHost}:${upstreamPort}`;
  headers["x-onyx-runtime-service"] = serviceName;

  const upstream = http.request(
    {
      host: upstreamHost,
      port: upstreamPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders.connection;
      res.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders);
      upstreamResponse.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    if (!res.headersSent) {
      json(res, 502, { error: "UPSTREAM_UNAVAILABLE" });
    } else {
      res.destroy(error);
    }
  });

  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});

server.requestTimeout = 0;
server.headersTimeout = 65_000;
server.listen(port, "0.0.0.0", () => {
  process.stdout.write(
    `[onyx-runtime] ${serviceName} gateway listening on 0.0.0.0:${port} -> ${upstreamHost}:${upstreamPort}\n`,
  );
});
