import { Injectable, signal } from '@angular/core';
import {
  AgentContext,
  VisualizationState,
  QueryState,
} from '../models/shared-state.models';

/**
 * SharedStateService
 *
 * Manages AG-UI shared state - structured context synced bi-directionally
 * between Angular and the ADK agent. Enables reliable multi-turn drill-downs.
 */
@Injectable({
  providedIn: 'root',
})
export class SharedStateService {
  // Core signal for agent context
  readonly agentContext = signal<AgentContext>({
    currentVisualization: null,
    lastQuery: null,
    activeFilters: {},
    dataSource: 'default',
    conversationIntent: null,
  });

  /**
   * Update the agent context with partial changes
   */
  updateContext(delta: Partial<AgentContext>): void {
    this.agentContext.update((current) => ({
      ...current,
      ...delta,
    }));
  }

  /**
   * Sync the Angular signal from the library's auto-patched agent state.
   * The @ag-ui/client library applies full RFC 6902 JSON Patch operations
   * via fast-json-patch internally — we just adopt the result.
   */
  syncFromAgent(state: any): void {
    if (!state || typeof state !== 'object') return;
    this.agentContext.set(state as AgentContext);
  }

  /**
   * Set the current visualization state
   */
  setVisualization(viz: VisualizationState): void {
    this.agentContext.update((current) => ({
      ...current,
      currentVisualization: viz,
    }));
  }

  /**
   * Set the last query state
   */
  setLastQuery(query: QueryState): void {
    this.agentContext.update((current) => ({
      ...current,
      lastQuery: query,
    }));
  }

  /**
   * Update active filters
   */
  updateFilters(filters: Record<string, any>): void {
    this.agentContext.update((current) => ({
      ...current,
      activeFilters: { ...current.activeFilters, ...filters },
    }));
  }

  /**
   * Reset the context to initial state
   */
  resetContext(): void {
    this.agentContext.set({
      currentVisualization: null,
      lastQuery: null,
      activeFilters: {},
      dataSource: 'default',
      conversationIntent: null,
    });
  }

}
