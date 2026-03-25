/**
 * TerminalManager - Minimal service interface stub.
 *
 * Full terminal/PTY management was removed (code-editor feature).
 * This stub exists only for test compatibility.
 */
import { ServiceMap } from "effect";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TerminalManagerShape {}

export class TerminalManager extends ServiceMap.Service<TerminalManager, TerminalManagerShape>()(
  "t3/terminal/Services/Manager",
) {}
