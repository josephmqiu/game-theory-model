/**
 * Git error types - Minimal stubs.
 *
 * Full git error hierarchy was removed with git operations.
 * These stubs exist for test compatibility.
 */
export class TextGenerationError {
  readonly _tag = "TextGenerationError";
  constructor(readonly input: { readonly operation: string; readonly detail: string }) {}
  get message(): string {
    return `${this.input.operation}: ${this.input.detail}`;
  }
}

export class GitCommandError {
  readonly _tag = "GitCommandError";
  constructor(readonly message: string) {}
}

export class GitManagerError {
  readonly _tag = "GitManagerError";
  constructor(readonly message: string) {}
}
