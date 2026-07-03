// entity-edit-state.ts — pure state machine for the overlay edit form (2.3A).
// The full state table: pristine → dirty → validating → saving →
// saved | queued | failed. Failure preserves input and carries field errors;
// queued means the edit applies after the in-flight analysis phase.

import { z } from "zod/v4";
import type { AnalysisEntity, EntityData } from "@/types/entity";
import { entityDataSchema } from "@/types/entity";

export type EditFormState =
  | { phase: "pristine" }
  | { phase: "dirty" }
  | { phase: "validating" }
  | { phase: "saving" }
  | { phase: "saved" }
  | { phase: "queued" }
  | {
      phase: "failed";
      error: string;
      fieldErrors: Record<string, string>;
    };

export type EditFormEvent =
  | { type: "EDIT" }
  | { type: "SUBMIT" }
  | { type: "CLIENT_VALID" }
  | { type: "CLIENT_INVALID"; fieldErrors: Record<string, string> }
  | { type: "SERVER_APPLIED" }
  | { type: "SERVER_QUEUED" }
  | {
      type: "SERVER_ERROR";
      error: string;
      fieldErrors?: Record<string, string>;
    }
  | { type: "RESET" };

export const INITIAL_EDIT_STATE: EditFormState = { phase: "pristine" };

export function editFormReducer(
  state: EditFormState,
  event: EditFormEvent,
): EditFormState {
  switch (event.type) {
    case "RESET":
      return INITIAL_EDIT_STATE;
    case "EDIT":
      // Any keystroke makes the form dirty; editing after a failure clears
      // the failure banner but the preserved input stays.
      if (
        state.phase === "pristine" ||
        state.phase === "failed" ||
        state.phase === "saved"
      ) {
        return { phase: "dirty" };
      }
      return state;
    case "SUBMIT":
      if (state.phase === "dirty" || state.phase === "failed") {
        return { phase: "validating" };
      }
      return state; // double-submit guard: saving/validating ignore SUBMIT
    case "CLIENT_VALID":
      return state.phase === "validating" ? { phase: "saving" } : state;
    case "CLIENT_INVALID":
      return state.phase === "validating"
        ? {
            phase: "failed",
            error: "Validation failed",
            fieldErrors: event.fieldErrors,
          }
        : state;
    case "SERVER_APPLIED":
      return state.phase === "saving" ? { phase: "saved" } : state;
    case "SERVER_QUEUED":
      return state.phase === "saving" ? { phase: "queued" } : state;
    case "SERVER_ERROR":
      return state.phase === "saving"
        ? {
            phase: "failed",
            error: event.error,
            fieldErrors: event.fieldErrors ?? {},
          }
        : state;
  }
}

export function isSubmittable(state: EditFormState): boolean {
  return state.phase === "dirty" || state.phase === "failed";
}

export function isBusy(state: EditFormState): boolean {
  return state.phase === "validating" || state.phase === "saving";
}

const rationaleSchema = z.string().min(1, "Rationale cannot be empty");

/**
 * Client-side pre-flight validation mirroring the server's 8A contract:
 * the full data object must satisfy the per-type schema and the type
 * discriminator cannot change. The server remains the source of truth —
 * this only gives instant feedback before the round-trip.
 */
export function validateEditClientSide(
  entity: Pick<AnalysisEntity, "type">,
  data: EntityData,
  rationale: string,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (data.type !== entity.type) {
    fieldErrors["data.type"] = "Entity type cannot be changed";
  } else {
    const parsed = entityDataSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key =
          issue.path.length > 0 ? `data.${issue.path.join(".")}` : "data";
        if (!(key in fieldErrors)) {
          fieldErrors[key] = issue.message;
        }
      }
    }
  }

  const rationaleParsed = rationaleSchema.safeParse(rationale);
  if (!rationaleParsed.success) {
    fieldErrors.rationale =
      rationaleParsed.error.issues[0]?.message ?? "Invalid";
  }

  return fieldErrors;
}
