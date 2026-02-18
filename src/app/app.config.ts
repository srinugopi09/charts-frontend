import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';

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
  ],
};
