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
  question: UserInputQuestion;
  status: UserInputQuestionStatus;
  answer?: UserInputAnswer;
}
