import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  ORCHESTRATION_WS_CHANNELS,
  ORCHESTRATION_WS_METHODS,
} from "./orchestration";
import { WebSocketRequest, WsResponse, WS_CHANNELS } from "./ws";

const decodeWebSocketRequest = Schema.decodeUnknownEffect(WebSocketRequest);
const decodeWsResponse = Schema.decodeUnknownEffect(WsResponse);

it.effect("trims websocket request id", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWebSocketRequest({
      id: " req-1 ",
      body: {
        _tag: ORCHESTRATION_WS_METHODS.getSnapshot,
      },
    });
    assert.strictEqual(parsed.id, "req-1");
    assert.strictEqual(parsed.body._tag, ORCHESTRATION_WS_METHODS.getSnapshot);
  }),
);

it.effect("accepts typed websocket push envelopes with sequence", () =>
  Effect.gen(function* () {
    const parsed = yield* decodeWsResponse({
      type: "push",
      sequence: 1,
      channel: WS_CHANNELS.serverWelcome,
      data: {
        cwd: "/tmp/workspace",
        projectName: "workspace",
      },
    });

    if (!("type" in parsed) || parsed.type !== "push") {
      assert.fail("expected websocket response to decode as a push envelope");
    }

    assert.strictEqual(parsed.type, "push");
    assert.strictEqual(parsed.sequence, 1);
    assert.strictEqual(parsed.channel, WS_CHANNELS.serverWelcome);
  }),
);

it.effect(
  "rejects push envelopes when channel payload does not match the channel schema",
  () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        decodeWsResponse({
          type: "push",
          sequence: 2,
          channel: ORCHESTRATION_WS_CHANNELS.domainEvent,
          data: {
            cwd: "/tmp/workspace",
            projectName: "workspace",
          },
        }),
      );

      assert.strictEqual(result._tag, "Failure");
    }),
);
