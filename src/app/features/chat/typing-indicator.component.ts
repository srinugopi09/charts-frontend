import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * TypingIndicatorComponent
 *
 * Displays three animated bouncing dots to indicate the agent is typing.
 * Shown while waiting for the first token of a response.
 */
@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-1.5 py-3">
      <div
        class="w-2.5 h-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full animate-bounce shadow-sm"
        style="animation-delay: 0ms; animation-duration: 1s;"></div>
      <div
        class="w-2.5 h-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full animate-bounce shadow-sm"
        style="animation-delay: 150ms; animation-duration: 1s;"></div>
      <div
        class="w-2.5 h-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full animate-bounce shadow-sm"
        style="animation-delay: 300ms; animation-duration: 1s;"></div>
      <span class="ml-2 text-sm text-gray-500 font-medium">AI is thinking...</span>
    </div>
  `,
})
export class TypingIndicatorComponent {}
