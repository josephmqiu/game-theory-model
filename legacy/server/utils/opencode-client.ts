const activeServers = new Set<{ close(): void }>();

function cleanup(): void {
  for (const server of activeServers) {
    try {
      server.close();
    } catch {
      // Ignore cleanup failures.
    }
  }
  activeServers.clear();
}

process.on("beforeExit", cleanup);
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

export async function getOpencodeClient() {
  const { createOpencodeClient, createOpencode } = await import(
    "@opencode-ai/sdk/v2"
  );

  try {
    const client = createOpencodeClient();
    await client.config.providers();
    return { client, server: undefined };
  } catch {
    const opencode = await createOpencode({ port: 0 });
    activeServers.add(opencode.server);
    return { client: opencode.client, server: opencode.server };
  }
}

export function releaseOpencodeServer(server: { close(): void } | undefined) {
  if (!server) return;
  try {
    server.close();
  } catch {
    // Ignore shutdown failures.
  }
  activeServers.delete(server);
}
