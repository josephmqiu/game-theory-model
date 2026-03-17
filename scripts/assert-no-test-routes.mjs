import { readdir } from "node:fs/promises";
import { join } from "node:path";

const routesDir = join(process.cwd(), ".output", "server", "_routes");

async function collectTestArtifacts(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...(await collectTestArtifacts(fullPath)));
      continue;
    }

    if (entry.name.includes(".test.")) {
      artifacts.push(fullPath);
    }
  }

  return artifacts;
}

try {
  const artifacts = await collectTestArtifacts(routesDir);
  if (artifacts.length > 0) {
    console.error("Build produced routable test artifacts:");
    for (const artifact of artifacts) {
      console.error(`- ${artifact}`);
    }
    process.exit(1);
  }
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  ) {
    process.exit(0);
  }

  throw error;
}
