export interface ChatAttachment {
  id: string;
  name: string;
  mediaType: string; // 'image/png', 'image/jpeg', etc.
  data: string; // base64-encoded (no data URL prefix)
  size: number; // bytes
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
  toolName?: string;
  toolStatus?: "running" | "done" | "error";
}

export interface AIStreamChunk {
  type:
    | "text"
    | "thinking"
    | "done"
    | "error"
    | "ping"
    | "session_expired"
    | "tool_call_start"
    | "tool_call_result";
  content: string;
}
