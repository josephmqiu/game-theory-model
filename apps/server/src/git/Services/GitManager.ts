/**
 * GitManager - Minimal service interface stub.
 *
 * Full git manager operations were removed (code-editor feature).
 * This stub retains only the service tag for test compatibility.
 */
import { ServiceMap } from "effect";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GitManagerShape {}

export class GitManager extends ServiceMap.Service<GitManager, GitManagerShape>()(
  "t3/git/Services/GitManager",
) {}
