import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ThreadService } from './thread.service';
import { ChatStateService } from './chat-state.service';
import { AgUiService } from './ag-ui.service';
import { A2UIEventService } from './a2ui-event.service';
import { SharedStateService } from './shared-state.service';
import {
  Thread,
  mapBackendMessages,
  extractA2UIPayloads,
} from '../models/thread.models';

const STORAGE_KEY = 'analytics-agent:active-thread';

/**
 * ConversationService
 *
 * Orchestrates thread management: listing, switching, creating, deleting.
 * Coordinates ThreadService, ChatStateService, AgUiService, A2UIEventService,
 * and SharedStateService to keep all state in sync during thread operations.
 */
@Injectable({
  providedIn: 'root',
})
export class ConversationService {
  private threadService = inject(ThreadService);
  private chatState = inject(ChatStateService);
  private agUiService = inject(AgUiService);
  private a2uiEventService = inject(A2UIEventService);
  private sharedState = inject(SharedStateService);

  /** Currently active thread ID (null = new unsaved conversation) */
  readonly activeThreadId = signal<string | null>(null);

  /** Thread list for the sidebar */
  readonly threads = signal<Thread[]>([]);

  /** Loading state for history fetch */
  readonly isLoadingHistory = signal<boolean>(false);

  /** Initialize: restore last active thread from localStorage */
  async init(): Promise<void> {
    const savedId = this.restoreActiveThread();
    await this.loadThreads();
    if (savedId) {
      await this.switchThread(savedId);
    }
  }

  /** Fetch thread list from backend */
  async loadThreads(): Promise<void> {
    try {
      const response = await firstValueFrom(this.threadService.getThreads());
      this.threads.set(response.threads);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  }

  /** Switch to an existing thread: load messages, rebuild chat + canvas */
  async switchThread(threadId: string): Promise<void> {
    this.isLoadingHistory.set(true);
    try {
      // 1. Fetch messages from backend
      const response = await firstValueFrom(
        this.threadService.getMessages(threadId),
      );

      // 2. Clear current state
      this.chatState.clearMessages();
      this.a2uiEventService.clearSurface();
      this.sharedState.resetContext();

      // 3. Map backend messages → ChatMessage[] and load into chat
      const chatMessages = mapBackendMessages(response.messages);
      this.chatState.loadMessages(chatMessages);

      // 4. Replay A2UI surfaces for canvas restoration (Phase 4)
      const a2uiPayloads = extractA2UIPayloads(response.messages);
      for (const payload of a2uiPayloads) {
        this.a2uiEventService.handleA2UIMessages(
          payload.surfaceId,
          payload.messages,
        );
      }

      // 5. Point HttpAgent at the selected thread
      this.agUiService.switchThread(threadId);

      // 6. Persist active thread
      this.activeThreadId.set(threadId);
      this.persistActiveThread(threadId);
    } catch (error) {
      console.error('Failed to switch thread:', error);
      this.chatState.setError('Failed to load conversation history');
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  /** Start a brand new conversation: clear everything, let HttpAgent auto-generate threadId */
  startNewConversation(): void {
    this.chatState.clearMessages();
    this.a2uiEventService.clearSurface();
    this.sharedState.resetContext();
    this.agUiService.startNewThread();
    this.activeThreadId.set(null);
    this.clearPersistedThread();
  }

  /** Delete a thread from backend and local state */
  async deleteThread(threadId: string): Promise<void> {
    try {
      await firstValueFrom(this.threadService.deleteThread(threadId));
      // Remove from local list
      this.threads.update((list) => list.filter((t) => t.id !== threadId));
      // If we deleted the active thread, start fresh
      if (this.activeThreadId() === threadId) {
        this.startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete thread:', error);
    }
  }

  /**
   * Called after a successful agent run to sync thread state.
   * - Captures the auto-generated threadId for new conversations
   * - Refreshes the thread list so new threads appear in sidebar
   */
  async onRunCompleted(): Promise<void> {
    const currentThreadId = this.agUiService.threadId;
    if (!this.activeThreadId() && currentThreadId) {
      this.activeThreadId.set(currentThreadId);
      this.persistActiveThread(currentThreadId);
    }
    await this.loadThreads();
  }

  private persistActiveThread(threadId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, threadId);
    } catch {
      // localStorage unavailable — ignore
    }
  }

  private restoreActiveThread(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private clearPersistedThread(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
