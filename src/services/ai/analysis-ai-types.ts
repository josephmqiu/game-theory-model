export type AnalysisAIIntent = 'answer' | 'edit'

export interface AnalysisAIRenameAnalysisOperation {
  type: 'rename-analysis'
  name: string
}

export interface AnalysisAIRenamePlayerOperation {
  type: 'rename-player'
  playerId: string
  name: string
}

export interface AnalysisAIAddStrategyOperation {
  type: 'add-strategy'
  playerId: string
  strategyId: string
  name: string
}

export interface AnalysisAIRenameStrategyOperation {
  type: 'rename-strategy'
  playerId: string
  strategyId: string
  name: string
}

export interface AnalysisAISetProfilePayoffsOperation {
  type: 'set-profile-payoffs'
  player1StrategyId: string
  player2StrategyId: string
  payoffs: [number | null, number | null]
}

export type AnalysisAIOperation =
  | AnalysisAIRenameAnalysisOperation
  | AnalysisAIRenamePlayerOperation
  | AnalysisAIAddStrategyOperation
  | AnalysisAIRenameStrategyOperation
  | AnalysisAISetProfilePayoffsOperation

export type AnalysisAIPlannerResult =
  | {
      kind: 'edit'
      operations: AnalysisAIOperation[]
    }
  | {
      kind: 'cannot_edit'
      reason: string
    }

export interface AnalysisAIContext {
  prompt: string
}
