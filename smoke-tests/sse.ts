import { cleanupDir, fetchJson, formatLogs, startBuiltServer, waitFor } from "./_lib";

type StreamEnvelope =
  | { channel: "mutation"; revision: number; type: string }
  | { channel: "progress"; revision: number; type: string }
  | { channel: "status"; revision: number; status: string }
  | { channel: "ping"; revision: number };

async function openSseStream(url: string) {
  const controller = new AbortController();
  const events: StreamEnvelope[] = [];
  const connected = new Promise<void>((resolveConnected, rejectConnected) => {
    void (async () => {
      try {
        const response = await fetch(url, {
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`Failed to open SSE stream: HTTP ${response.status}`);
        }

        resolveConnected();

        const reader = response.body.getReader();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += Buffer.from(value).toString("utf-8");

          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex >= 0) {
            const entry = buffer.slice(0, boundaryIndex).trim();
            buffer = buffer.slice(boundaryIndex + 2);
            if (entry.startsWith("data: ")) {
              events.push(JSON.parse(entry.slice(6)) as StreamEnvelope);
            }
            boundaryIndex = buffer.indexOf("\n\n");
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          rejectConnected(error);
        }
      }
    })();
  });

  return {
    close: () => controller.abort(),
    connected,
    events,
  };
}

async function main(): Promise<void> {
  let started:
    | Awaited<ReturnType<typeof startBuiltServer>>
    | null = null;

  try {
    started = await startBuiltServer();
    const streamUrl = `${started.baseUrl}/api/ai/events`;
    const stream = await openSseStream(streamUrl);
    await stream.connected;

    const analyzeResponse = await fetch(`${started.baseUrl}/api/ai/analyze`, {
      body: JSON.stringify({
        provider: "anthropic",
        runtime: {
          activePhases: ["situational-grounding", "player-identification"],
          webSearch: false,
        },
        topic: "Smoke test topic",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!analyzeResponse.ok) {
      throw new Error(`Analyze kickoff failed with HTTP ${analyzeResponse.status}`);
    }

    await waitFor(
      () =>
        stream.events.some((event) => event.channel === "status") &&
        stream.events.some((event) => event.channel === "progress") &&
        stream.events.some((event) => event.channel === "mutation"),
      {
        message: "Timed out waiting for status/progress/mutation events",
        timeoutMs: 20_000,
      },
    );

    await waitFor(
      async () => {
        const state = await fetchJson<{
          analysis: { entities: unknown[] };
          runStatus: { status: string };
        }>(`${started!.baseUrl}/api/ai/state`);
        return state.analysis.entities.length > 0 && state.runStatus.status === "idle";
      },
      {
        message: "Timed out waiting for completed analysis state",
        timeoutMs: 20_000,
      },
    );

    await waitFor(
      () => stream.events.some((event) => event.channel === "ping"),
      {
        message: "Timed out waiting for SSE heartbeat",
        timeoutMs: 5_000,
      },
    );

    stream.close();

    const recoveredState = await fetchJson<{
      analysis: { entities: unknown[] };
      revision: number;
      runStatus: { status: string };
    }>(`${started.baseUrl}/api/ai/state`);

    if (recoveredState.analysis.entities.length === 0) {
      throw new Error("Recovered state did not include analysis entities");
    }

    const reconnectedStream = await openSseStream(streamUrl);
    await reconnectedStream.connected;
    await waitFor(
      () => reconnectedStream.events.some((event) => event.channel === "ping"),
      {
        message: "Timed out waiting for heartbeat after SSE reconnect",
        timeoutMs: 5_000,
      },
    );
    reconnectedStream.close();

    console.log(
      JSON.stringify({
        ok: true,
        channels: [...new Set(stream.events.map((event) => event.channel))],
        eventCount: stream.events.length,
        revision: recoveredState.revision,
      }),
    );
  } catch (error) {
    const details =
      started === null
        ? error instanceof Error
          ? error.message
          : String(error)
        : `${error instanceof Error ? error.message : String(error)}\n${formatLogs(started.process)}`;
    console.error(details);
    process.exitCode = 1;
  } finally {
    if (started) {
      await started.process.stop();
      await cleanupDir(started.userDataDir);
    }
  }
}

await main();
