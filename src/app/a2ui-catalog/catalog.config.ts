import { EnvironmentProviders } from '@angular/core';
import { provideA2UI, Catalog, DEFAULT_CATALOG } from '@a2ui/angular';

/**
 * A2UI Catalog Configuration
 *
 * Registers all custom A2UI components with lazy loading.
 * Maps A2UI type names to Angular component imports.
 *
 * NOTE: Using type assertions for theme to bypass strict typing.
 * Will refine once backend integration is tested.
 */
export function provideA2UICatalog(): EnvironmentProviders {
  const catalog: Catalog = {
    // Chart Component
    Graph: () => import('./chart/graph.component').then((m) => m.GraphComponent),

    // KPI Card Component
    KPICard: () => import('./kpi/kpi-card.component').then((m) => m.KPICardComponent),

    // Data Table Component
    DataTable: () => import('./table/data-table.component').then((m) => m.DataTableComponent),

    // RAG Status Indicator Component
    RAGIndicator: () =>
      import('./status/rag-indicator.component').then((m) => m.RAGIndicatorComponent),

    // Insight Card Component
    InsightCard: () =>
      import('./text/insight-card.component').then((m) => m.InsightCardComponent),

    // Composite Dashboard Component
    CompositeDashboard: () =>
      import('./dashboard/composite-dashboard.component').then(
        (m) => m.CompositeDashboardComponent
      ),
  };

  return provideA2UI({
    catalog: { ...DEFAULT_CATALOG, ...catalog },
    theme: {} as any, // Temporary: bypass strict theme typing
  });
}
