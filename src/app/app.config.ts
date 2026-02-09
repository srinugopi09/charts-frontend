import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';

// Core services
import { ChatStateService } from './core/services/chat-state.service';
import { SharedStateService } from './core/services/shared-state.service';
import { ChartAdapterService } from './core/services/chart-adapter.service';
import { AgUiService } from './core/services/ag-ui.service';
import { A2UIEventService } from './core/services/a2ui-event.service';

// A2UI Catalog
import { provideA2UICatalog } from './a2ui-catalog/catalog.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),

    // Markdown support
    provideMarkdown(),

    // A2UI Catalog
    provideA2UICatalog(),

    // Core services (provided in root, but listed for clarity)
    ChatStateService,
    SharedStateService,
    ChartAdapterService,
    AgUiService,
    A2UIEventService,
  ],
};
