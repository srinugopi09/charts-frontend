import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogBaseComponent } from '../catalog-base.component';
import { MarkdownModule } from 'ngx-markdown';

/**
 * InsightCardComponent
 *
 * Card displaying text insights with markdown support.
 * Features:
 * - Markdown rendering for body content
 * - Optional icon with color-coded border
 * - Priority-based styling
 *
 * CRITICAL: Properties accessed via getProp() from component().properties.
 */
@Component({
  selector: 'app-insight-card',
  standalone: true,
  imports: [CommonModule, MarkdownModule],
  template: `
    <div [class]="cardClass" class="p-4 bg-white border-l-4 rounded-lg shadow-sm">
      <!-- Header with Icon -->
      <div class="flex items-start gap-3 mb-2">
        @if (icon) {
          <div [class]="iconClass" class="flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              @switch (icon) {
                @case ('info') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
                @case ('warning') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                }
                @case ('success') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
                @case ('error') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
                @default {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                }
              }
            </svg>
          </div>
        }

        <!-- Title -->
        @if (title) {
          <h4 class="flex-1 text-base font-semibold text-gray-900">{{ title }}</h4>
        }

        <!-- Priority Badge -->
        @if (priority) {
          <span [class]="priorityBadgeClass" class="flex-shrink-0 px-2 py-1 text-xs font-medium rounded">
            {{ priorityLabel }}
          </span>
        }
      </div>

      <!-- Body (Markdown) -->
      @if (body) {
        <div class="prose prose-sm max-w-none text-gray-700" markdown [data]="body"></div>
      }
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .prose {
        font-size: 0.875rem;
        line-height: 1.5;
      }

      :host ::ng-deep .prose p {
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
      }

      :host ::ng-deep .prose ul,
      :host ::ng-deep .prose ol {
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
      }

      :host ::ng-deep .prose code {
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class InsightCardComponent extends CatalogBaseComponent {
  // Property getters via getProp pattern
  get title(): string | undefined {
    return this.getProp<string>('title');
  }

  get body(): string | undefined {
    return this.getProp<string>('body');
  }

  get icon(): 'info' | 'warning' | 'success' | 'error' | 'lightbulb' | undefined {
    return this.getProp<'info' | 'warning' | 'success' | 'error' | 'lightbulb'>('icon');
  }

  get priority(): 'high' | 'medium' | 'low' | undefined {
    return this.getProp<'high' | 'medium' | 'low'>('priority');
  }

  protected get cardClass(): string {
    const iconMap: Record<string, string> = {
      info: 'border-blue-500',
      warning: 'border-amber-500',
      success: 'border-green-500',
      error: 'border-red-500',
      lightbulb: 'border-purple-500',
    };
    return this.icon ? iconMap[this.icon] : 'border-gray-300';
  }

  protected get iconClass(): string {
    const iconMap: Record<string, string> = {
      info: 'text-blue-500',
      warning: 'text-amber-500',
      success: 'text-green-500',
      error: 'text-red-500',
      lightbulb: 'text-purple-500',
    };
    return this.icon ? iconMap[this.icon] : 'text-gray-500';
  }

  protected get priorityBadgeClass(): string {
    const priorityMap: Record<string, string> = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'bg-gray-100 text-gray-800',
    };
    return this.priority ? priorityMap[this.priority] : '';
  }

  protected get priorityLabel(): string {
    const priorityMap: Record<string, string> = {
      high: 'High Priority',
      medium: 'Medium',
      low: 'Low',
    };
    return this.priority ? priorityMap[this.priority] : '';
  }
}
