import type {
  ThreadMessageState,
  ActivityEntry,
} from "../../../shared/types/workspace-state";
import type { MethodologyPhase } from "../../../shared/types/methodology";
import type { ChatAttachment, ChatMessage } from "@/services/ai/ai-types";
import type { PendingTurn } from "@/stores/thread-store";

function estimateAttachmentSize(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

function projectAttachments(
  messageId: string,
  attachments: ThreadMessageState["attachments"],
): ChatAttachment[] | undefined {
  if (!attachments?.length) {
    return undefined;
  }

  return attachments.map((attachment, index) => ({
    id: `${messageId}-attachment-${index}`,
    name: attachment.name,
    mediaType: attachment.mediaType,
    data: attachment.data,
    size: estimateAttachmentSize(attachment.data),
  }));
}

export function projectThreadMessagesToChatMessages(
  messages: ThreadMessageState[],
): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.createdAt,
    attachments: projectAttachments(message.id, message.attachments),
  }));
}

// ---------------------------------------------------------------------------
// Pending turn → ChatMessage[] projection
// ---------------------------------------------------------------------------

export function projectPendingTurnToMessages(turn: PendingTurn): ChatMessage[] {
  const result: ChatMessage[] = [
    {
      id: turn.userMessage.id,
      role: "user",
      content: turn.userMessage.content,
      timestamp: turn.userMessage.timestamp,
    },
  ];

  for (const tc of turn.toolCalls) {
    result.push({
      id: tc.id,
      role: "assistant",
      content: tc.content,
      timestamp: turn.assistantMessage.timestamp,
      isStreaming: tc.status === "running",
      toolName: tc.toolName,
      toolStatus: tc.status,
    });
  }

  result.push({
    id: turn.assistantMessage.id,
    role: "assistant",
    content: turn.assistantMessage.content,
    timestamp: turn.assistantMessage.timestamp,
    isStreaming: turn.assistantMessage.isStreaming,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Unified transcript projection — interleaves messages, activities, and
// phase transition markers into a single ordered list for rendering.
// ---------------------------------------------------------------------------

export type TranscriptEntryKind = "message" | "activity" | "phase-divider";

export interface TranscriptMessageEntry {
  kind: "message";
  id: string;
  message: ChatMessage;
}

export interface TranscriptActivityEntry {
  kind: "activity";
  id: string;
  activityKind:
    | ActivityEntry["kind"]
    | "phase-started"
    | "phase-completed"
    | "phase-failed";
  message: string;
  status?: ActivityEntry["status"];
  toolName?: string;
  query?: string;
  timestamp: number;
  isLive?: boolean;
  phase?: MethodologyPhase;
}

export interface TranscriptPhaseDividerEntry {
  kind: "phase-divider";
  id: string;
  phaseNumber: number;
  phaseName: string;
  phase: MethodologyPhase;
  status: "running" | "completed" | "failed" | "pending";
}

export type TranscriptEntry =
  | TranscriptMessageEntry
  | TranscriptActivityEntry
  | TranscriptPhaseDividerEntry;

/** Map MethodologyPhase to a 1-based index for display. */
const PHASE_ORDER: Record<string, number> = {
  "situational-grounding": 1,
  "player-identification": 2,
  "baseline-model": 3,
  "historical-game": 4,
  revalidation: 5,
  "formal-modeling": 6,
  assumptions: 7,
  elimination: 8,
  scenarios: 9,
  "meta-check": 10,
};

const PHASE_DISPLAY_NAMES: Record<string, string> = {
  "situational-grounding": "Situational Grounding",
  "player-identification": "Player Identification",
  "baseline-model": "Baseline Model",
  "historical-game": "Historical Game",
  revalidation: "Revalidation",
  "formal-modeling": "Formal Modeling",
  assumptions: "Assumptions",
  elimination: "Elimination",
  scenarios: "Scenarios",
  "meta-check": "Meta-Check",
};

/**
 * Build a unified transcript from messages and activities.
 *
 * Activities are interleaved between messages based on timestamps.
 * Phase transitions are inserted when the phase changes between activities.
 */
export function buildTranscript(
  messages: ThreadMessageState[],
  activities: ActivityEntry[],
  options?: {
    /** Phase turns — used to derive phase-divider status */
    activePhase?: MethodologyPhase | null;
    /** Which phases have completed */
    completedPhases?: Set<MethodologyPhase>;
    /** Which phases have failed */
    failedPhases?: Set<MethodologyPhase>;
  },
): TranscriptEntry[] {
  const projected = projectThreadMessagesToChatMessages(messages);
  const result: TranscriptEntry[] = [];

  // Build a timeline from both sources
  type TimelineItem =
    | { type: "message"; ts: number; message: ChatMessage }
    | { type: "activity"; ts: number; activity: ActivityEntry };

  const timeline: TimelineItem[] = [
    ...projected.map((m) => ({
      type: "message" as const,
      ts: m.timestamp,
      message: m,
    })),
    ...activities.map((a) => ({
      type: "activity" as const,
      ts: a.occurredAt,
      activity: a,
    })),
  ];

  // Stable sort by timestamp, preserving original order for ties
  timeline.sort((a, b) => a.ts - b.ts);

  // Track which phase we've emitted a divider for
  let lastPhase: MethodologyPhase | null = null;

  for (const item of timeline) {
    if (item.type === "message") {
      result.push({
        kind: "message",
        id: item.message.id,
        message: item.message,
      });
    } else {
      const activity = item.activity;

      // Insert phase divider if the phase changed
      if (activity.phase && activity.phase !== lastPhase) {
        lastPhase = activity.phase;
        const phaseNum = PHASE_ORDER[activity.phase] ?? 0;
        const phaseName = PHASE_DISPLAY_NAMES[activity.phase] ?? activity.phase;

        let status: TranscriptPhaseDividerEntry["status"] = "pending";
        if (options?.activePhase === activity.phase) {
          status = "running";
        } else if (options?.completedPhases?.has(activity.phase)) {
          status = "completed";
        } else if (options?.failedPhases?.has(activity.phase)) {
          status = "failed";
        }

        result.push({
          kind: "phase-divider",
          id: `phase-divider-${activity.phase}-${activity.occurredAt}`,
          phaseNumber: phaseNum,
          phaseName,
          phase: activity.phase,
          status,
        });
      }

      result.push({
        kind: "activity",
        id: activity.id,
        activityKind: activity.kind,
        message: activity.message,
        status: activity.status,
        toolName: activity.toolName,
        query: activity.query,
        timestamp: activity.occurredAt,
        phase: activity.phase,
      });
    }
  }

  return result;
}
