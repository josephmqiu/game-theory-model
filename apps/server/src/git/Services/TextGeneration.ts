/**
 * TextGeneration - Minimal service interface stub.
 *
 * Full text generation via Codex was removed (code-editor feature).
 * This stub retains only the service tag and the shape used by
 * ProviderCommandReactor (generateBranchName).
 */
import { Effect, Layer, ServiceMap } from "effect";
import type { TextGenerationError } from "../Errors.ts";

export interface TextGenerationShape {
  readonly generateBranchName: (input: {
    readonly cwd: string;
    readonly message: string;
    readonly attachments?: ReadonlyArray<unknown>;
    readonly model: string;
  }) => Effect.Effect<
    { readonly branch: string } | undefined,
    TextGenerationError
  >;
}

export class TextGeneration extends ServiceMap.Service<
  TextGeneration,
  TextGenerationShape
>()("t3/git/Services/TextGeneration") {}

/** Stub layer: generateBranchName always returns undefined (skip branch renaming). */
export const TextGenerationStub = Layer.succeed(TextGeneration, {
  generateBranchName: () => Effect.succeed(undefined),
} satisfies TextGenerationShape);
