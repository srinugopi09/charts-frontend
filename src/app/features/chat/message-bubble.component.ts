import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { ChatMessage } from '../../core/models/chat.models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { TypingIndicatorComponent } from './typing-indicator.component';

/**
 * MessageBubbleComponent
 *
 * Displays a single chat message (user or assistant).
 * - User messages: right-aligned, simple
 * - Assistant messages: left-aligned, markdown, tool transparency
 * - Streaming support with typing indicator
 */
@Component({
  selector: 'app-message-bubble',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MarkdownModule,
    RelativeTimePipe,
    TypingIndicatorComponent,
  ],
  template: `
    <div class="mb-6 animate-slideIn">
      @if (message.role === 'user') {
        <!-- User message: right-aligned with avatar -->
        <div class="flex justify-end items-start gap-3 group">
          <div class="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl px-5 py-3 max-w-2xl shadow-md hover:shadow-lg transition-all duration-200">
            <p class="text-sm whitespace-pre-wrap leading-relaxed">{{ message.content }}</p>
            <span class="text-xs text-blue-100 mt-2 block opacity-75">{{
              message.timestamp | relativeTime
            }}</span>
          </div>
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center ring-2 ring-blue-200">
            <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      } @else {
        <!-- Assistant message: left-aligned with AI avatar -->
        <div class="flex justify-start items-start gap-3 group">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center ring-2 ring-purple-200 shadow-sm">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div class="bg-white rounded-2xl px-5 py-4 max-w-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
            @if (message.isStreaming && !message.content) {
              <app-typing-indicator />
            } @else {
              <div class="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:shadow-inner">
                <markdown [data]="message.content"></markdown>
              </div>
            }

            <!-- Tool call transparency (collapsible) -->
            @if (message.toolCalls && message.toolCalls.length > 0) {
              <details class="mt-4 border-t border-gray-100 pt-3 group/details">
                <summary
                  class="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors duration-150 select-none">
                  <svg
                    class="w-4 h-4 transition-transform duration-200 group-open/details:rotate-90"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Agent Activity</span>
                  <span class="ml-auto text-xs text-gray-400 font-normal">({{ message.toolCalls.length }} {{ message.toolCalls.length === 1 ? 'tool' : 'tools' }})</span>
                </summary>
                <div class="mt-3 space-y-2 animate-fadeIn">
                  @for (tool of message.toolCalls; track tool.toolName) {
                    <div class="text-xs bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                      <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold text-gray-700 flex items-center gap-1.5">
                          <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          {{ tool.toolName }}
                        </span>
                        @if (tool.executionTimeMs) {
                          <span class="text-gray-500 font-mono">{{ tool.executionTimeMs }}ms</span>
                        }
                      </div>
                      @if (tool.arguments?.['sql']) {
                        <pre class="bg-gray-900 text-gray-100 p-3 rounded-md text-xs mt-2 overflow-x-auto shadow-inner"><code>{{ tool.arguments?.['sql'] }}</code></pre>
                      }
                    </div>
                  }
                </div>
              </details>
            }

            <span class="text-xs text-gray-400 mt-3 block font-medium">{{
              message.timestamp | relativeTime
            }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class MessageBubbleComponent {
  @Input({ required: true }) message!: ChatMessage;
}
