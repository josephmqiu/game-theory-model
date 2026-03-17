import type { Phase6Subsection } from '../types/analysis-pipeline'

export const PHASE6_ALL_SUBSECTIONS: Phase6Subsection[] = ['6a', '6b', '6c', '6d', '6e', '6f', '6g', '6h', '6i']

export const PHASE6_SUBSECTION_MESSAGES: Record<Phase6Subsection, string> = {
  '6a': '6a: Choosing formal representations...',
  '6b': '6b: Estimating structured payoffs...',
  '6c': '6c: Computing baseline equilibrium summaries...',
  '6d': '6d: Comparing equilibrium selection candidates...',
  '6e': '6e: Reviewing bargaining dynamics...',
  '6f': '6f: Classifying strategic communication...',
  '6g': '6g: Checking the option value of waiting...',
  '6h': '6h: Documenting adjacent behavioral overlays...',
  '6i': '6i: Evaluating cross-game effects...',
}
