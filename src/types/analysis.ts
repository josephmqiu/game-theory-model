export type AnalysisPayoffValue = number | null

export interface AnalysisStrategy {
  id: string
  name: string
}

export interface AnalysisPlayer {
  id: string
  name: string
  strategies: AnalysisStrategy[]
}

export interface AnalysisProfile {
  player1StrategyId: string
  player2StrategyId: string
  payoffs: [AnalysisPayoffValue, AnalysisPayoffValue]
}

export interface Analysis {
  id: string
  name: string
  players: [AnalysisPlayer, AnalysisPlayer]
  profiles: AnalysisProfile[]
}

export interface AnalysisValidationIssue {
  path: string
  message: string
}

export interface AnalysisValidation {
  isValid: boolean
  isComplete: boolean
  issues: AnalysisValidationIssue[]
  incompleteProfiles: Array<{
    player1StrategyId: string
    player2StrategyId: string
  }>
}

export const ANALYSIS_FILE_TYPE = 'game-theory-analysis'
export const ANALYSIS_FILE_VERSION = 1 as const

export interface AnalysisFileV1 {
  type: typeof ANALYSIS_FILE_TYPE
  version: typeof ANALYSIS_FILE_VERSION
  analysis: Analysis
}

export interface AnalysisFileReference {
  fileName: string | null
  filePath: string | null
  fileHandle: FileSystemFileHandle | null
}
