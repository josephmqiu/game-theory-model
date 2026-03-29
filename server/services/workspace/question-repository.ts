import type { DatabaseSync } from "node:sqlite";
import type {
  PendingQuestionState,
  UserInputAnswer,
  UserInputQuestion,
  UserInputQuestionStatus,
} from "../../../shared/types/user-input";
import { parseJsonColumn, stringifyJson } from "./sqlite-json";

export interface QuestionRepository {
  upsertPendingQuestion(
    workspaceId: string,
    question: UserInputQuestion,
  ): PendingQuestionState;
  listByRunId(
    runId: string,
    statusFilter?: UserInputQuestionStatus,
  ): PendingQuestionState[];
  resolvePendingQuestion(
    questionId: string,
    answer: UserInputAnswer,
  ): PendingQuestionState | undefined;
  updateStatus(questionId: string, status: UserInputQuestionStatus): void;
  getById(questionId: string): PendingQuestionState | undefined;
  listByThreadId(
    threadId: string,
    statusFilter?: UserInputQuestionStatus,
  ): PendingQuestionState[];
  listByStatus(status: UserInputQuestionStatus): PendingQuestionState[];
}

function mapQuestionRow(row: Record<string, unknown>): PendingQuestionState {
  const question = parseJsonColumn<UserInputQuestion>(
    row.question_json,
    "pending_questions.question_json",
  );
  const answer = row.answer_json
    ? parseJsonColumn<UserInputAnswer>(
        row.answer_json,
        "pending_questions.answer_json",
      )
    : undefined;
  return {
    kind: "question",
    question,
    status: row.status as UserInputQuestionStatus,
    answer,
  };
}

export function createQuestionRepository(db: DatabaseSync): QuestionRepository {
  const getStatement = db.prepare(
    `SELECT status, question_json, answer_json
     FROM pending_questions
     WHERE id = $id
     LIMIT 1`,
  );
  const listByThreadStatement = db.prepare(
    `SELECT status, question_json, answer_json
     FROM pending_questions
     WHERE thread_id = $threadId
     ORDER BY created_at ASC`,
  );
  const listByThreadAndStatusStatement = db.prepare(
    `SELECT status, question_json, answer_json
     FROM pending_questions
     WHERE thread_id = $threadId AND status = $status
     ORDER BY created_at ASC`,
  );
  const listByStatusStatement = db.prepare(
    `SELECT status, question_json, answer_json
     FROM pending_questions
     WHERE status = $status
     ORDER BY created_at ASC`,
  );
  const listByRunStatement = db.prepare(
    `SELECT status, question_json, answer_json
     FROM pending_questions
     WHERE run_id = $runId
     ORDER BY created_at ASC`,
  );
  const listByRunAndStatusStatement = db.prepare(
    `SELECT status, question_json, answer_json
     FROM pending_questions
     WHERE run_id = $runId AND status = $status
     ORDER BY created_at ASC`,
  );
  const upsertStatement = db.prepare(
    `INSERT INTO pending_questions (
       id, workspace_id, thread_id, run_id, phase,
       status, question_json, answer_json,
       created_at, resolved_at, updated_at
     ) VALUES (
       $id, $workspaceId, $threadId, $runId, $phase,
       $status, $questionJson, $answerJson,
       $createdAt, $resolvedAt, $updatedAt
     )
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       question_json = excluded.question_json,
       answer_json = excluded.answer_json,
       resolved_at = excluded.resolved_at,
       updated_at = excluded.updated_at`,
  );
  const updateStatusStatement = db.prepare(
    `UPDATE pending_questions
     SET status = $status, updated_at = $updatedAt
     WHERE id = $id`,
  );
  const resolveStatement = db.prepare(
    `UPDATE pending_questions
     SET status = 'resolved',
         answer_json = $answerJson,
         resolved_at = $resolvedAt,
         updated_at = $updatedAt
     WHERE id = $id`,
  );

  return {
    upsertPendingQuestion(workspaceId, question) {
      const now = Date.now();
      upsertStatement.run({
        $id: question.id,
        $workspaceId: workspaceId,
        $threadId: question.threadId,
        $runId: question.runId ?? null,
        $phase: question.phase ?? null,
        $status: "pending",
        $questionJson: stringifyJson(question),
        $answerJson: null,
        $createdAt: question.createdAt,
        $resolvedAt: null,
        $updatedAt: now,
      });

      const stored = getStatement.get({ $id: question.id });
      if (!stored) {
        throw new Error(`Failed to persist pending question "${question.id}".`);
      }
      return mapQuestionRow(stored);
    },

    listByRunId(runId, statusFilter) {
      if (statusFilter) {
        return listByRunAndStatusStatement
          .all({ $runId: runId, $status: statusFilter })
          .map((row) => mapQuestionRow(row));
      }
      return listByRunStatement
        .all({ $runId: runId })
        .map((row) => mapQuestionRow(row));
    },

    resolvePendingQuestion(questionId, answer) {
      const now = Date.now();
      resolveStatement.run({
        $id: questionId,
        $answerJson: stringifyJson(answer),
        $resolvedAt: answer.resolvedAt,
        $updatedAt: now,
      });
      const stored = getStatement.get({ $id: questionId });
      return stored ? mapQuestionRow(stored) : undefined;
    },

    updateStatus(questionId, status) {
      updateStatusStatement.run({
        $id: questionId,
        $status: status,
        $updatedAt: Date.now(),
      });
    },

    getById(questionId) {
      const row = getStatement.get({ $id: questionId });
      return row ? mapQuestionRow(row) : undefined;
    },

    listByThreadId(threadId, statusFilter) {
      if (statusFilter) {
        return listByThreadAndStatusStatement
          .all({ $threadId: threadId, $status: statusFilter })
          .map((row) => mapQuestionRow(row));
      }
      return listByThreadStatement
        .all({ $threadId: threadId })
        .map((row) => mapQuestionRow(row));
    },

    listByStatus(status) {
      return listByStatusStatement
        .all({ $status: status })
        .map((row) => mapQuestionRow(row));
    },
  };
}
