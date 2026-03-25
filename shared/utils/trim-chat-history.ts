/**
 * Shared context optimization utilities for bounded chat history.
 * Used by both renderer compatibility code and the server-owned chat service.
 */

const DEFAULT_MAX_MESSAGES = 10;
const DEFAULT_MAX_CHARS = 32_000;

export function trimChatHistory<T extends { role: string; content: string }>(
  messages: T[],
  maxMessages: number = DEFAULT_MAX_MESSAGES,
  maxChars: number = DEFAULT_MAX_CHARS,
): T[] {
  if (messages.length <= maxMessages) {
    const totalChars = messages.reduce((sum, message) => {
      return sum + message.content.length;
    }, 0);
    if (totalChars <= maxChars) {
      return messages;
    }
  }

  const firstUser = messages.find((message) => message.role === "user");
  const recentMessages = messages.slice(-maxMessages);

  const window: T[] = [];
  let charCount = 0;

  if (firstUser && !recentMessages.includes(firstUser)) {
    window.push(firstUser);
    charCount += firstUser.content.length;
  }

  for (const message of recentMessages) {
    const messageChars = message.content.length;
    if (charCount + messageChars > maxChars) {
      const remaining = maxChars - charCount;
      if (remaining > 200) {
        window.push({
          ...message,
          content: `${message.content.slice(0, remaining)}\n[...truncated...]`,
        } as T);
      }
      break;
    }
    window.push(message);
    charCount += messageChars;
  }

  return window;
}
