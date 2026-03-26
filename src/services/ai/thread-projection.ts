import type {
  ThreadMessageState,
} from "../../../shared/types/workspace-state";
import type { ChatAttachment, ChatMessage } from "@/services/ai/ai-types";

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
