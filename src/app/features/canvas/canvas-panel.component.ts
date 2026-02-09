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
          } @else if (currentSurface()) {
            <!-- A2UI Surface Renderer with modern container -->
            <div class="max-w-6xl mx-auto animate-fadeIn">
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

  // Computed states
  protected hasVisualization = computed(() => this.currentSurface() !== null);

  protected isLoading = computed(() => {
    // Show loading if streaming AND no visualization yet
    return this.isStreaming() && !this.hasVisualization();
  });

  protected visualizationTitle = computed(() => {
    const surface = this.currentSurface();
    if (!surface || !surface.componentTree) return '';

    // Extract title from component tree root
    // The componentTree is the root AnyComponentNode
    // For custom components, we'd need to inspect the component type
    return 'Visualization'; // Simplified for now - could extract from componentTree props
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

  /**
   * Handle A2UI action events (drill-downs, detail requests, etc.)
   */
  protected handleAction(action: any): void {
    console.log('CanvasPanelComponent.handleAction called with:', action);
    this.a2uiEventService.handleA2UIAction(action);
  }
}
