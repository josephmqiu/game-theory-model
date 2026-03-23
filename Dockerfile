# ── Stage 1: Build secondary Nitro runtime ──
FROM oven/bun:1 AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun --bun run build

# ── Stage 2: Base runtime image ──
FROM oven/bun:1-slim AS base

WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000
CMD ["bun", "run", "./.output/server/index.mjs"]

# ── AI-enabled runtime variants ──

FROM oven/bun:1 AS with-claude
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
RUN bun install -g @anthropic-ai/claude-code
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
EXPOSE 3000
CMD ["bun", "run", "./.output/server/index.mjs"]

FROM oven/bun:1 AS with-codex
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
RUN bun install -g @openai/codex
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
EXPOSE 3000
CMD ["bun", "run", "./.output/server/index.mjs"]
