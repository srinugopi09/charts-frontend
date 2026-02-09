import { Component, input, output } from '@angular/core';

/**
 * CanvasEmptyStateComponent
 *
 * Welcome message with example question cards to help users get started.
 * Shows when there's no active conversation or visualization.
 */
@Component({
  selector: 'app-canvas-empty-state',
  standalone: true,
  template: `
    <div class="h-full overflow-y-auto flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-white to-purple-50 animate-fadeIn">
      <div class="max-w-3xl w-full text-center">
        <!-- Welcome Header with modern icon -->
        <div class="mb-12 animate-slideIn">
          <div class="mx-auto h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/20 ring-4 ring-blue-100">
            <svg
              class="h-12 w-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 class="text-3xl font-bold text-gray-900 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Welcome to Analytics Chat
          </h2>
          <p class="text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
            Ask questions about your data and get <span class="font-semibold text-blue-600">instant insights</span> with <span class="font-semibold text-purple-600">interactive visualizations</span>
          </p>
        </div>

        <!-- Example Questions with modern cards -->
        <div class="mb-8">
          <p class="text-sm font-semibold text-gray-700 mb-5 flex items-center justify-center gap-2">
            <svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Try asking:
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (example of exampleQuestions; track example) {
              <button
                (click)="onExampleClick.emit(example)"
                class="group p-5 text-left bg-white border-2 border-gray-100 rounded-2xl hover:border-blue-400 hover:shadow-xl hover:scale-105 transition-all duration-300 hover:-translate-y-1">
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span class="text-sm text-gray-700 group-hover:text-blue-700 font-medium leading-relaxed flex-1">
                    {{ example }}
                  </span>
                  <svg class="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            }
          </div>
        </div>

        <!-- Hint with icon -->
        <div class="flex items-center justify-center gap-2 text-sm text-gray-500">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Or type your own question in the chat panel on the left</span>
        </div>
      </div>
    </div>
  `,
})
export class CanvasEmptyStateComponent {
  readonly hasConversation = input<boolean>(false);
  readonly onExampleClick = output<string>();

  protected readonly exampleQuestions = [
    'Show revenue by region',
    'Top 10 projects by budget',
    'What are the sales trends over the last quarter?',
    'Compare customer satisfaction scores across departments',
  ];
}
