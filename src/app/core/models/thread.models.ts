import { randomUUID } from '@ag-ui/client';
import { ChatMessage } from './chat.models';

// ── Backend DTOs ──────────────────────────────────────────────

export interface Thread {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadListResponse {
  threads: Thread[];
  total: number;
}

export interface BackendMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  message_id?: string;
  tool_call_name?: string;
  tool_call_id?: string;
  event_data?: {
    a2ui?: boolean;
    surfaceId?: string;
    messages?: any[];
    [key: string]: any;
  };
}

export interface ThreadMessagesResponse {
  thread_id: string;
  messages: BackendMessage[];
}

// ── A2UI payload extracted from history ───────────────────────

export interface A2UIHistoryPayload {
  surfaceId: string;
  messages: any[];
}

// ── Mapping functions ─────────────────────────────────────────

/**
 * Convert backend messages to ChatMessage[] for the chat panel.
 * Skips tool invocations and tool results (those are handled separately for canvas).
 */
export function mapBackendMessages(messages: BackendMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];

  for (const msg of messages) {
    // User messages → chat bubble
    if (msg.role === 'user') {
      result.push({
        id: randomUUID(),
        role: 'user',
        content: msg.content,
        timestamp: new Date(),
        isStreaming: false,
        a2uiPayload: null,
        toolCalls: null,
      });
      continue;
    }

    // Assistant text responses (no tool_call_name) → chat bubble
    if (msg.role === 'assistant' && !msg.tool_call_name) {
      result.push({
        id: msg.message_id || randomUUID(),
        role: 'assistant',
        content: msg.content,
        timestamp: new Date(),
        isStreaming: false,
        a2uiPayload: null,
        toolCalls: null,
      });
      continue;
    }

    // Skip: assistant with tool_call_name (tool invocation indicator)
    // Skip: tool results (rendered on canvas via extractA2UIPayloads)
  }

  return result;
}

/**
 * Extract A2UI visualization payloads from backend messages.
 * These are replayed through A2UIEventService to rebuild the canvas.
 */
export function extractA2UIPayloads(messages: BackendMessage[]): A2UIHistoryPayload[] {
  const payloads: A2UIHistoryPayload[] = [];

  for (const msg of messages) {
    if (
      msg.role === 'tool' &&
      msg.event_data?.a2ui === true &&
      msg.event_data.surfaceId &&
      Array.isArray(msg.event_data.messages)
    ) {
      payloads.push({
        surfaceId: msg.event_data.surfaceId,
        messages: msg.event_data.messages,
      });
    }
  }

  return payloads;
}
