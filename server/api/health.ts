import { defineEventHandler } from "h3";

export default defineEventHandler(() => {
  return { status: "ok", app: "game-theory-analyzer" };
});
