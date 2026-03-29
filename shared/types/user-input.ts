export interface UserInputOption {
  label: string;
  description?: string;
}

export interface UserInputQuestion {
  id: string;
  threadId: string;
  runId?: string;
  phase?: string;
  header: string;
  question: string;
  options?: UserInputOption[];
  multiSelect?: boolean;
  createdAt: number;
}

export interface UserInputAnswer {
  questionId: string;
  selectedOptions?: number[];
  customText?: string;
  resolvedAt: number;
}

export type UserInputQuestionStatus = "pending" | "resolved" | "dismissed";

export interface PendingQuestionState {
  kind: "question";
  question: UserInputQuestion;
  status: UserInputQuestionStatus;
  answer?: UserInputAnswer;
}

export interface ToolApprovalInteraction {
  id: string;
  threadId: string;
  runId?: string;
  phase?: string;
  header: string;
  question: string;
  toolName?: string;
  createdAt: number;
}

export type ToolApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "dismissed";

export interface ToolApprovalResolution {
  approvalId: string;
  approved: boolean;
  reason?: string;
  resolvedAt: number;
}

export interface PendingApprovalState {
  kind: "approval";
  approval: ToolApprovalInteraction;
  status: ToolApprovalStatus;
  resolution?: ToolApprovalResolution;
}

export type PendingInteractionState =
  | PendingQuestionState
  | PendingApprovalState;
