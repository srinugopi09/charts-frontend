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
   * Apply a JSON Patch to the agent context (for STATE_DELTA events)
   * Simplified implementation - handles basic replace operations
   */
  applyJsonPatch(patch: any): void {
    if (!patch || !Array.isArray(patch)) return;

    this.agentContext.update((current) => {
      let updated = { ...current };

      for (const operation of patch) {
        if (operation.op === 'replace' && operation.path && operation.value !== undefined) {
          const path = operation.path.split('/').filter((p: string) => p);
          this.applyReplace(updated, path, operation.value);
        }
      }

      return updated;
    });
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

  /**
   * Helper to apply a replace operation to a nested path
   */
  private applyReplace(obj: any, path: string[], value: any): void {
    if (path.length === 0) return;

    if (path.length === 1) {
      obj[path[0]] = value;
      return;
    }

    const [head, ...tail] = path;
    if (!obj[head]) {
      obj[head] = {};
    }
    this.applyReplace(obj[head], tail, value);
  }
}
