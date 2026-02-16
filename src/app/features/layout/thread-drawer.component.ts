import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  signal,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConversationService } from '../../core/services/conversation.service';
import { Thread } from '../../core/models/thread.models';

/**
 * ThreadDrawerComponent
 *
 * Slide-out drawer that overlays the chat panel.
 * Displays thread list, new conversation button, and per-thread delete.
 */
@Component({
  selector: 'app-thread-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        (click)="close()"></div>

      <!-- Drawer panel -->
      <div
        class="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 flex flex-col animate-slideInLeft">
        <!-- Header -->
        <div class="h-14 px-4 flex items-center justify-between border-b border-gray-200 flex-shrink-0">
          <h2 class="text-lg font-semibold text-gray-800">Conversations</h2>
          <button
            (click)="close()"
            class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close drawer">
            <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- New conversation button -->
        <div class="px-3 py-3 border-b border-gray-100 flex-shrink-0">
          <button
            (click)="onNewConversation()"
            class="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>
        </div>

        <!-- Thread list -->
        <div class="flex-1 min-h-0 overflow-y-auto">
          @if (conversation.isLoadingHistory()) {
            <!-- Loading skeleton -->
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="px-4 py-3 border-b border-gray-50">
                <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-2"></div>
                <div class="h-3 bg-gray-100 rounded animate-pulse w-1/2"></div>
              </div>
            }
          } @else if (conversation.threads().length === 0) {
            <div class="px-4 py-8 text-center text-gray-400 text-sm">
              No conversations yet
            </div>
          } @else {
            @for (thread of conversation.threads(); track thread.id) {
              <div
                class="group px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2"
                [class.bg-blue-50]="thread.id === conversation.activeThreadId()"
                [class.border-l-2]="thread.id === conversation.activeThreadId()"
                [class.border-l-blue-500]="thread.id === conversation.activeThreadId()"
                (click)="onSelectThread(thread)">
                <div class="flex-1 min-w-0">
                  @if (editingThreadId() === thread.id) {
                    <!-- Inline title edit -->
                    <input
                      #editInput
                      type="text"
                      [ngModel]="editingTitle()"
                      (ngModelChange)="editingTitle.set($event)"
                      (keydown.enter)="saveTitle(thread)"
                      (keydown.escape)="cancelEdit()"
                      (blur)="saveTitle(thread)"
                      (click)="$event.stopPropagation()"
                      class="w-full text-sm font-medium text-gray-800 bg-white border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  } @else {
                    <p class="text-sm font-medium text-gray-800 truncate"
                       (dblclick)="startEdit($event, thread)">
                      {{ thread.title || 'Untitled' }}
                    </p>
                  }
                  <p class="text-xs text-gray-400 mt-0.5">
                    {{ formatDate(thread.updated_at) }}
                  </p>
                </div>
                <!-- Edit button -->
                <button
                  (click)="startEdit($event, thread)"
                  class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-100 transition-all"
                  [class.hidden]="editingThreadId() === thread.id"
                  aria-label="Rename conversation">
                  <svg class="w-4 h-4 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <!-- Delete button -->
                <button
                  (click)="onDeleteThread($event, thread)"
                  class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                  aria-label="Delete conversation">
                  <svg class="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slideInLeft {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
    .animate-slideInLeft {
      animation: slideInLeft 0.2s ease-out;
    }
  `],
})
export class ThreadDrawerComponent {
  @ViewChild('editInput') editInputRef?: ElementRef<HTMLInputElement>;

  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();

  protected conversation = inject(ConversationService);
  protected editingThreadId = signal<string | null>(null);
  protected editingTitle = signal('');

  close(): void {
    this.closed.emit();
  }

  async onNewConversation(): Promise<void> {
    this.conversation.startNewConversation();
    this.close();
  }

  async onSelectThread(thread: Thread): Promise<void> {
    // Don't navigate if we're editing this thread's title
    if (this.editingThreadId() === thread.id) return;

    if (thread.id === this.conversation.activeThreadId()) {
      this.close();
      return;
    }
    await this.conversation.switchThread(thread.id);
    this.close();
  }

  startEdit(event: Event, thread: Thread): void {
    event.stopPropagation();
    this.editingThreadId.set(thread.id);
    this.editingTitle.set(thread.title || '');
    // Focus the input after Angular renders it
    setTimeout(() => this.editInputRef?.nativeElement.focus(), 0);
  }

  async saveTitle(thread: Thread): Promise<void> {
    // Guard against double-fire: Enter key removes the input, which triggers blur
    if (this.editingThreadId() === null) return;
    const newTitle = this.editingTitle().trim();
    this.editingThreadId.set(null);
    if (newTitle && newTitle !== (thread.title || '')) {
      await this.conversation.renameThread(thread.id, newTitle);
    }
  }

  cancelEdit(): void {
    this.editingThreadId.set(null);
  }

  async onDeleteThread(event: Event, thread: Thread): Promise<void> {
    event.stopPropagation();
    await this.conversation.deleteThread(thread.id);
  }

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
