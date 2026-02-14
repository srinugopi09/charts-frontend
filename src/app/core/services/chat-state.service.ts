import { Injectable, computed, signal } from '@angular/core';
import { ChatMessage, ToolCallInfo } from '../models/chat.models';
import { A2UISurface } from '../models/a2ui.models';

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
  readonly lastVisualization = computed(() => {
    const msgs = this.messages();
    // Find the most recent message with an A2UI payload
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].a2uiPayload !== null) {
        return msgs[i];
      }
    }
    return null;
  });

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
      a2uiPayload: null,
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
    // If there's already an active streaming message, finalize it first
    if (this.currentStreamingMessage()) {
      this.finalizeStreamingMessage();
    }

    const message: ChatMessage = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      a2uiPayload: null,
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
        // Remove the duplicate message instead of finalizing it
        this.messages.update((msgs) =>
          msgs.filter((m) => m.id !== current.id)
        );
        this.currentStreamingMessage.set(null);
        this.isStreaming.set(false);
        return;
      }
    }

    // Remove empty assistant messages (no content and no tool calls / a2ui payload)
    if (!finalContent && !actualMsg?.toolCalls?.length && !actualMsg?.a2uiPayload) {
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
          // Check if this tool call already exists (by name) and update it
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
   * Attach an A2UI payload to the current streaming message
   */
  attachA2UIPayload(payload: A2UISurface): void {
    const current = this.currentStreamingMessage();
    if (!current) {
      // If no streaming message, attach to the last assistant message
      this.messages.update((msgs) => {
        const lastAssistant = [...msgs]
          .reverse()
          .find((m) => m.role === 'assistant');
        if (!lastAssistant) return msgs;

        return msgs.map((msg) =>
          msg.id === lastAssistant.id ? { ...msg, a2uiPayload: payload } : msg
        );
      });
      return;
    }

    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.id === current.id ? { ...msg, a2uiPayload: payload } : msg
      )
    );
  }

  /**
   * Remove a message by ID (e.g., chart JSON messages not meant for display)
   */
  removeMessage(messageId: string): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== messageId));
  }

  /**
   * Set an error message
   */
  setError(message: string): void {
    this.error.set(message);
    this.isStreaming.set(false);
    this.currentStreamingMessage.set(null);
  }

  /**
   * Clear the current error
   */
  clearError(): void {
    this.error.set(null);
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

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
