import { mkdir, writeFile } from "node:fs/promises";

await mkdir("/data/projects", { recursive: true });

const key = process.env.MOTION_BYOK_API_KEY?.trim() ?? "";
if (!key) {
  process.stdout.write("[onyx-runtime] motion BYOK key not configured; generation capability is not ready.\n");
  process.exit(0);
}

const provider = process.env.MOTION_BYOK_PROVIDER?.trim() || "anthropic";
if (!["anthropic", "openai", "google"].includes(provider)) {
  throw new Error("MOTION_BYOK_PROVIDER must be anthropic, openai, or google.");
}

const model = process.env.MOTION_BYOK_MODEL?.trim() || undefined;
const config = {
  provider,
  key,
  ...(model ? { model } : {}),
};

await mkdir("/opt/motion-anything/app", { recursive: true });
await writeFile(
  "/opt/motion-anything/app/user-byok.json",
  JSON.stringify(config, null, 2),
  { mode: 0o600 },
);

process.stdout.write(`[onyx-runtime] motion BYOK configured for provider ${provider}.\n`);
