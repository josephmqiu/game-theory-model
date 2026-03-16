/**
 * Shared phase definitions for the 10-phase analysis pipeline.
 */

export const PHASES = [
  { id: 1, label: "Grounding" },
  { id: 2, label: "Players" },
  { id: 3, label: "Base Games" },
  { id: 4, label: "Cross-Game" },
  { id: 5, label: "Dynamics" },
  { id: 6, label: "Formalization" },
  { id: 7, label: "Assumptions" },
  { id: 8, label: "Elimination" },
  { id: 9, label: "Scenarios" },
  { id: 10, label: "Meta-Check" },
] as const;

export const PHASE_NAMES: Record<number, string> = Object.fromEntries(
  PHASES.map(({ id, label }) => [id, label]),
);
