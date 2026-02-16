import { Component, ChangeDetectionStrategy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatStateService } from '../../core/services/chat-state.service';
import { AgUiService } from '../../core/services/ag-ui.service';

/**
 * InputBarComponent
 *
 * Message input with send/cancel functionality.
 * Features:
 * - Auto-resizing textarea
 * - Enter to send, Shift+Enter for newline
 * - Send button (enabled when non-empty AND !isStreaming)
 * - Cancel button (visible only during streaming)
 */
@Component({
  selector: 'app-input-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="border-t border-gray-200 bg-gradient-to-b from-white to-gray-50 px-6 py-4 shadow-lg">
      <div class="max-w-4xl mx-auto">
        <div class="flex items-end gap-3 bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 hover:shadow-md focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50 transition-all duration-200">
          <textarea
            #inputTextarea
            [(ngModel)]="inputText"
            (keydown)="onKeyDown($event)"
            (input)="autoResize()"
            aria-label="Ask about your data"
            placeholder="Ask about your data..."
            class="flex-1 resize-none border-0 bg-white px-3 py-2.5 max-h-24 focus:outline-none disabled:bg-gray-50 text-black placeholder-gray-400 font-semibold"
            rows="1"></textarea>

          @if (isStreaming()) {
            <button
              (click)="onCancel()"
              aria-label="Cancel agent response"
              class="flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center gap-2 group">
              <svg class="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          } @else {
            <button
              (click)="onSend()"
              [disabled]="!canSend()"
              class="flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none font-medium shadow-sm hover:shadow-md flex items-center gap-2 group">
              <span>Send</span>
              <svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          }
        </div>

        @if (chatState.error()) {
          <div role="alert" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 animate-slideIn">
            <svg class="w-5 h-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ chatState.error() }}</span>
          </div>
        }

        <div class="mt-2 text-xs text-gray-500 text-center">
          <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono">Enter</kbd> to send
          <span class="mx-2">•</span>
          <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  `,
})
export class InputBarComponent {
  @ViewChild('inputTextarea') textareaRef?: ElementRef<HTMLTextAreaElement>;

  protected chatState = inject(ChatStateService);
  private agUiService = inject(AgUiService);

  protected inputText = signal<string>('');
  protected isStreaming = this.chatState.isStreaming;

  protected canSend = computed(() => {
    return this.inputText().trim().length > 0 && !this.isStreaming();
  });

  /**
   * Handle keyboard events
   */
  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  /**
   * Send message
   */
  protected async onSend(): Promise<void> {
    const text = this.inputText().trim();
    if (!text || this.isStreaming()) return;

    // Clear input immediately
    this.inputText.set('');
    this.resetTextareaHeight();

    // Add user message
    this.chatState.addUserMessage(text);

    // Run agent — post-run thread sync is handled automatically via
    // ConversationService's subscription to AgUiService.runCompleted$
    try {
      await this.agUiService.runAgent();
    } catch (error) {
      console.error('Failed to run agent:', error);
    }
  }

  /**
   * Cancel current stream
   */
  protected onCancel(): void {
    this.agUiService.cancel();
  }

  /**
   * Auto-resize textarea based on content
   */
  protected autoResize(): void {
    if (!this.textareaRef) return;

    const textarea = this.textareaRef.nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`; // max-h-24 = 96px
  }

  /**
   * Reset textarea height
   */
  private resetTextareaHeight(): void {
    if (!this.textareaRef) return;
    this.textareaRef.nativeElement.style.height = 'auto';
  }
}
