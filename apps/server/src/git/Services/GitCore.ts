/**
 * GitCore - Minimal service interface stub.
 *
 * Full git operations were removed (code-editor feature). This stub
 * retains only the service tag and the subset of the shape that
 * ProviderCommandReactor still references (renameBranch).
 */
import { Effect, Layer, ServiceMap } from "effect";

export interface GitCoreShape {
  readonly renameBranch: (input: {
    readonly cwd: string;
    readonly oldBranch: string;
    readonly newBranch: string;
  }) => Effect.Effect<{ readonly branch: string }, GitCoreError>;
}

export class GitCoreError {
  readonly _tag = "GitCoreError";
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

export class GitCore extends ServiceMap.Service<GitCore, GitCoreShape>()(
  "t3/git/Services/GitCore",
) {}

/** Stub layer: renameBranch returns the requested branch name without touching git. */
export const GitCoreStub = Layer.succeed(GitCore, {
  renameBranch: (input) => Effect.succeed({ branch: input.newBranch }),
} satisfies GitCoreShape);
