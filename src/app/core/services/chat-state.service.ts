import { Injectable, computed, signal } from '@angular/core';
import { randomUUID } from '@ag-ui/client';
import { ChatMessage, ToolCallInfo } from '../models/chat.models';

/**
 * ChatStateService
 *
 * Manages conversation messages, streaming status, and session identity.
 * All state is managed through Angular signals for reactive updates.
 */
@Injectable({
  providedIn: 'root',
})
export class ChatStateService {
  // Core signals
  readonly messages = signal<ChatMessage[]>([]);
  readonly isStreaming = signal<boolean>(false);
  readonly currentStreamingMessage = signal<ChatMessage | null>(null);
  readonly error = signal<string | null>(null);

  // Computed signals
  readonly messageCount = computed(() => this.messages().length);
  readonly hasActiveConversation = computed(() => this.messageCount() > 0);

  /**
   * Add a user message to the conversation
   */
  addUserMessage(content: string): void {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      isStreaming: false,
      toolCalls: null,
    };

    this.messages.update((msgs) => [...msgs, message]);
    this.clearError();
  }

  /**
   * Start a new assistant message (called when TEXT_MESSAGE_START event received).
   * Guards against creating a duplicate message when one is already streaming.
   */
  startAssistantMessage(): void {
    if (this.currentStreamingMessage()) {
      this.finalizeStreamingMessage();
    }

    const message: ChatMessage = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      toolCalls: null,
    };

    this.messages.update((msgs) => [...msgs, message]);
    this.currentStreamingMessage.set(message);
    this.isStreaming.set(true);
  }

  /**
   * Append content delta to the current streaming message
   */
  appendStreamingContent(delta: string): void {
    const current = this.currentStreamingMessage();
    if (!current) return;

    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.id === current.id ? { ...msg, content: msg.content + delta } : msg
      )
    );
  }

  /**
   * Finalize the current streaming message.
   * Removes duplicate if an earlier assistant message has identical content.
   */
  finalizeStreamingMessage(): void {
    const current = this.currentStreamingMessage();
    if (!current) return;

    // Look up the actual accumulated content (current ref may be stale)
    const actualMsg = this.messages().find((m) => m.id === current.id);
    const finalContent = actualMsg?.content?.trim() || '';

    // Check for duplicate: does a *previous* finalized assistant message
    // already have the same content?
    if (finalContent) {
      const isDuplicate = this.messages().some(
        (m) =>
          m.id !== current.id &&
          m.role === 'assistant' &&
          !m.isStreaming &&
          m.content.trim() === finalContent
      );

      if (isDuplicate) {
        this.messages.update((msgs) =>
          msgs.filter((m) => m.id !== current.id)
        );
        this.currentStreamingMessage.set(null);
        this.isStreaming.set(false);
        return;
      }
    }

    // Remove empty assistant messages (no content and no tool calls)
    if (!finalContent && !actualMsg?.toolCalls?.length) {
      this.messages.update((msgs) =>
        msgs.filter((m) => m.id !== current.id)
      );
      this.currentStreamingMessage.set(null);
      this.isStreaming.set(false);
      return;
    }

    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.id === current.id ? { ...msg, isStreaming: false } : msg
      )
    );

    this.currentStreamingMessage.set(null);
    this.isStreaming.set(false);
  }

  /**
   * Add a tool call to the current streaming message
   */
  addToolCall(toolInfo: ToolCallInfo): void {
    const current = this.currentStreamingMessage();
    if (!current) return;

    this.messages.update((msgs) =>
      msgs.map((msg) => {
        if (msg.id === current.id) {
          const existingCalls = msg.toolCalls || [];
          const existingIndex = existingCalls.findIndex(
            (call) => call.toolName === toolInfo.toolName
          );

          const updatedCalls =
            existingIndex >= 0
              ? existingCalls.map((call, idx) =>
                  idx === existingIndex ? toolInfo : call
                )
              : [...existingCalls, toolInfo];

          return { ...msg, toolCalls: updatedCalls };
        }
        return msg;
      })
    );
  }

  /**
   * Remove a message by ID (e.g., chart JSON messages not meant for display)
   */
  removeMessage(messageId: string): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== messageId));
  }

  setError(message: string): void {
    this.error.set(message);
    this.isStreaming.set(false);
    this.currentStreamingMessage.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }

  /**
   * Replace all messages with a pre-built array (for loading history from backend)
   */
  loadMessages(messages: ChatMessage[]): void {
    this.messages.set(messages);
    this.currentStreamingMessage.set(null);
    this.isStreaming.set(false);
    this.clearError();
  }

  /**
   * Clear all messages (reset conversation)
   */
  clearMessages(): void {
    this.messages.set([]);
    this.currentStreamingMessage.set(null);
    this.isStreaming.set(false);
    this.clearError();
  }

  private generateMessageId(): string {
    return randomUUID();
  }
}
