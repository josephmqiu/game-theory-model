import { describe, expect, it } from "vitest";
import type { AnalysisEntity, EntityData } from "@/types/entity";
import {
  editFormReducer,
  INITIAL_EDIT_STATE,
  isBusy,
  isSubmittable,
  validateEditClientSide,
  type EditFormState,
} from "../entity-edit-state";

function run(events: Parameters<typeof editFormReducer>[1][]): EditFormState {
  return events.reduce(editFormReducer, INITIAL_EDIT_STATE);
}

describe("editFormReducer (2.3A state table)", () => {
  it("pristine → dirty on first edit", () => {
    expect(run([{ type: "EDIT" }])).toEqual({ phase: "dirty" });
  });

  it("full happy path: dirty → validating → saving → saved", () => {
    expect(
      run([
        { type: "EDIT" },
        { type: "SUBMIT" },
        { type: "CLIENT_VALID" },
        { type: "SERVER_APPLIED" },
      ]),
    ).toEqual({ phase: "saved" });
  });

  it("queued path: saving → queued (mid-run edits)", () => {
    expect(
      run([
        { type: "EDIT" },
        { type: "SUBMIT" },
        { type: "CLIENT_VALID" },
        { type: "SERVER_QUEUED" },
      ]),
    ).toEqual({ phase: "queued" });
  });

  it("client-side validation failure carries field errors", () => {
    const state = run([
      { type: "EDIT" },
      { type: "SUBMIT" },
      {
        type: "CLIENT_INVALID",
        fieldErrors: { "data.content": "Required" },
      },
    ]);
    expect(state).toEqual({
      phase: "failed",
      error: "Validation failed",
      fieldErrors: { "data.content": "Required" },
    });
  });

  it("server failure carries the error and field errors", () => {
    const state = run([
      { type: "EDIT" },
      { type: "SUBMIT" },
      { type: "CLIENT_VALID" },
      {
        type: "SERVER_ERROR",
        error: "Validation failed",
        fieldErrors: { rationale: "Rationale cannot be empty" },
      },
    ]);
    expect(state.phase).toBe("failed");
    if (state.phase === "failed") {
      expect(state.fieldErrors.rationale).toBe("Rationale cannot be empty");
    }
  });

  it("failed → dirty on edit (failure banner clears, input preserved)", () => {
    const state = run([
      { type: "EDIT" },
      { type: "SUBMIT" },
      { type: "CLIENT_INVALID", fieldErrors: {} },
      { type: "EDIT" },
    ]);
    expect(state).toEqual({ phase: "dirty" });
  });

  it("failed → validating on resubmit", () => {
    const state = run([
      { type: "EDIT" },
      { type: "SUBMIT" },
      { type: "CLIENT_INVALID", fieldErrors: {} },
      { type: "SUBMIT" },
    ]);
    expect(state).toEqual({ phase: "validating" });
  });

  it("double-submit is a no-op while validating or saving", () => {
    const validating = run([{ type: "EDIT" }, { type: "SUBMIT" }]);
    expect(editFormReducer(validating, { type: "SUBMIT" })).toEqual(validating);

    const saving = editFormReducer(validating, { type: "CLIENT_VALID" });
    expect(editFormReducer(saving, { type: "SUBMIT" })).toEqual(saving);
  });

  it("SUBMIT from pristine is ignored (nothing to save)", () => {
    expect(run([{ type: "SUBMIT" }])).toEqual(INITIAL_EDIT_STATE);
  });

  it("RESET returns to pristine from anywhere", () => {
    const state = run([
      { type: "EDIT" },
      { type: "SUBMIT" },
      { type: "CLIENT_VALID" },
      { type: "RESET" },
    ]);
    expect(state).toEqual(INITIAL_EDIT_STATE);
  });

  it("helpers: submittable/busy classification", () => {
    expect(isSubmittable({ phase: "dirty" })).toBe(true);
    expect(
      isSubmittable({ phase: "failed", error: "x", fieldErrors: {} }),
    ).toBe(true);
    expect(isSubmittable({ phase: "pristine" })).toBe(false);
    expect(isSubmittable({ phase: "saving" })).toBe(false);
    expect(isBusy({ phase: "validating" })).toBe(true);
    expect(isBusy({ phase: "saving" })).toBe(true);
    expect(isBusy({ phase: "dirty" })).toBe(false);
  });
});

describe("validateEditClientSide", () => {
  const entity: Pick<AnalysisEntity, "type"> = { type: "fact" };
  const validData: EntityData = {
    type: "fact",
    date: "2026-03-19",
    source: "test",
    content: "Valid content",
    category: "action",
  };

  it("passes valid data", () => {
    expect(validateEditClientSide(entity, validData, "rationale")).toEqual({});
  });

  it("maps schema violations to field paths", () => {
    const errors = validateEditClientSide(
      entity,
      { ...validData, category: "bogus" as never },
      "rationale",
    );
    expect(errors["data.category"]).toBeTruthy();
  });

  it("rejects empty rationale", () => {
    const errors = validateEditClientSide(entity, validData, "");
    expect(errors.rationale).toBe("Rationale cannot be empty");
  });

  it("rejects type changes", () => {
    const errors = validateEditClientSide(
      entity,
      { ...validData, type: "player" } as never,
      "rationale",
    );
    expect(errors["data.type"]).toBe("Entity type cannot be changed");
  });
});
