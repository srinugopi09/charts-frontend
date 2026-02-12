import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MessageListComponent } from './message-list.component';
import { InputBarComponent } from './input-bar.component';

/**
 * ChatPanelComponent
 *
 * Assembly component for the chat panel.
 * Simple flex column layout combining message list and input bar.
 */
@Component({
  selector: 'app-chat-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MessageListComponent, InputBarComponent],
  template: `
    <div class="h-full flex flex-col bg-gray-50 overflow-hidden">
      <app-message-list class="flex-1 min-h-0 overflow-y-auto" />
      <app-input-bar class="flex-shrink-0" />
    </div>
  `,
})
export class ChatPanelComponent {}
