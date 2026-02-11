import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Surface } from '@a2ui/angular';
import { A2UIEventService } from '../../core/services/a2ui-event.service';
import { ChatStateService } from '../../core/services/chat-state.service';
import { AgUiService } from '../../core/services/ag-ui.service';
import { CanvasEmptyStateComponent } from './canvas-empty-state.component';
import { CanvasToolbarComponent } from './canvas-toolbar.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton.component';

/**
 * CanvasPanelComponent
 *
 * Main canvas panel for displaying visualizations.
 * Features:
 * - Empty state when no visualization
 * - Loading skeleton during streaming
 * - Toolbar with chart title and controls
 * - A2UI renderer for dynamic visualizations (Phase 7)
 */
@Component({
  selector: 'app-canvas-panel',
  standalone: true,
  imports: [
    CommonModule,
    Surface,
    CanvasEmptyStateComponent,
    CanvasToolbarComponent,
    LoadingSkeletonComponent,
  ],
  template: `
    <div class="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white overflow-hidden">
      @if (!hasVisualization() && !isLoading()) {
        <!-- Empty State -->
        <app-canvas-empty-state
          [hasConversation]="hasConversation()"
          (onExampleClick)="handleExampleClick($event)" />
      } @else {
        <!-- Active Visualization -->
        <app-canvas-toolbar [title]="visualizationTitle()" />

        <div class="flex-1 overflow-auto p-8">
          @if (isLoading()) {
            <!-- Loading State with modern container -->
            <div class="max-w-6xl mx-auto">
              <app-loading-skeleton type="chart" [height]="'500px'" />
            </div>
          } @else if (catalogError()) {
            <!-- Visualization error -->
            <div class="max-w-2xl mx-auto p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-red-800">Visualization Error</p>
                  <p class="text-sm text-red-700 mt-1">{{ catalogError() }}</p>
                </div>
              </div>
            </div>
          } @else if (currentSurface()) {
            <!-- A2UI Surface Renderer -->
            <div class="w-full animate-fadeIn">
              <!-- Note: Actions are handled via MessageProcessor.events, not (action) output -->
              <a2ui-surface
                [surfaceId]="'main'"
                [surface]="currentSurface()" />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CanvasPanelComponent {
  private a2uiEventService = inject(A2UIEventService);
  private chatState = inject(ChatStateService);
  private agUiService = inject(AgUiService);

  // Signals from services
  protected currentSurface = this.a2uiEventService.currentSurface;
  protected isStreaming = this.chatState.isStreaming;
  protected hasConversation = this.chatState.hasActiveConversation;

  // Error signal from A2UI processing
  protected catalogError = this.a2uiEventService.catalogValidationError;

  // Computed states
  protected hasVisualization = computed(() => this.currentSurface() !== null);

  protected isLoading = computed(() => {
    // Show loading if streaming AND no visualization yet
    return this.isStreaming() && !this.hasVisualization();
  });

  protected visualizationTitle = computed(() => {
    const surface = this.currentSurface();
    if (!surface || !surface.componentTree) return '';

    const tree: any = surface.componentTree;
    // Try component properties first, fall back to component type name
    return tree.properties?.title || tree.type || 'Visualization';
  });

  /**
   * Handle example question click - add as user message and trigger agent
   */
  protected async handleExampleClick(question: string): Promise<void> {
    this.chatState.addUserMessage(question);

    // Trigger agent to process the question
    try {
      await this.agUiService.runAgent();
    } catch (error) {
      console.error('Failed to run agent:', error);
    }
  }

}
