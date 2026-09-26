import { Container, getContainer } from "@cloudflare/containers";
import { env as workerEnv } from "cloudflare:workers";

function compactEnvVars(values) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => typeof value === "string" && value.length > 0,
    ),
  );
}

class OnyxRuntimeContainer extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "1h";
  enableInternet = true;
  pingEndpoint = "localhost/__onyx/health";
}

export class OpenLovableContainer extends OnyxRuntimeContainer {
  envVars = compactEnvVars({
    ONYX_RUNTIME_TOKEN: workerEnv.ONYX_OPEN_LOVABLE_TOKEN,
    FIRECRAWL_API_KEY: workerEnv.FIRECRAWL_API_KEY,
    GEMINI_API_KEY: workerEnv.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: workerEnv.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: workerEnv.OPENAI_API_KEY,
    GROQ_API_KEY: workerEnv.GROQ_API_KEY,
    SANDBOX_PROVIDER: workerEnv.SANDBOX_PROVIDER || "e2b",
    E2B_API_KEY: workerEnv.E2B_API_KEY,
    VERCEL_TEAM_ID: workerEnv.VERCEL_TEAM_ID,
    VERCEL_PROJECT_ID: workerEnv.VERCEL_PROJECT_ID,
    VERCEL_TOKEN: workerEnv.VERCEL_TOKEN,
  });
}

export class MotionAnythingContainer extends OnyxRuntimeContainer {
  envVars = compactEnvVars({
    ONYX_RUNTIME_TOKEN: workerEnv.ONYX_MOTION_ANYTHING_TOKEN,
    MOTION_BYOK_PROVIDER: workerEnv.MOTION_BYOK_PROVIDER || "anthropic",
    MOTION_BYOK_API_KEY: workerEnv.MOTION_BYOK_API_KEY,
    MOTION_BYOK_MODEL: workerEnv.MOTION_BYOK_MODEL,
  });
}

export class HtmlVideoContainer extends OnyxRuntimeContainer {
  envVars = compactEnvVars({
    ONYX_RUNTIME_TOKEN: workerEnv.ONYX_HTML_VIDEO_TOKEN,
    ANTHROPIC_API_KEY: workerEnv.HTML_VIDEO_ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN: workerEnv.HTML_VIDEO_ANTHROPIC_AUTH_TOKEN,
    ANTHROPIC_BASE_URL: workerEnv.HTML_VIDEO_ANTHROPIC_BASE_URL,
  });
}

const SERVICES = {
  "open-lovable": "OPEN_LOVABLE_CONTAINER",
  "motion-anything": "MOTION_ANYTHING_CONTAINER",
  "html-video": "HTML_VIDEO_CONTAINER",
};

function routeRequest(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const service = parts.shift();

  if (!service || !(service in SERVICES)) {
    return null;
  }

  const bindingName = SERVICES[service];
  const binding = env[bindingName];
  if (!binding) {
    return new Response(JSON.stringify({ error: "RUNTIME_BINDING_UNAVAILABLE" }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  url.pathname = "/" + parts.join("/");
  if (url.pathname === "/") {
    url.pathname = "/__onyx/health";
  }

  const forwarded = new Request(url.toString(), request);
  return getContainer(binding, "singleton").fetch(forwarded);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/__onyx/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          router: "onyx-runtime-router",
          services: Object.keys(SERVICES),
          persistence: "container-disk-ephemeral",
        }),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    }

    const response = routeRequest(request, env);
    if (response) return response;

    return new Response(
      JSON.stringify({
        error: "NOT_FOUND",
        routes: [
          "/open-lovable/api/*",
          "/motion-anything/api/*",
          "/html-video/api/*"
        ],
      }),
      {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  },
};
