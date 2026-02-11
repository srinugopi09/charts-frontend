import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Renderer } from '@a2ui/angular';
import { CatalogBaseComponent } from '../catalog-base.component';

/**
 * CompositeDashboardComponent
 *
 * Container for multiple A2UI components in a grid layout.
 * Uses A2UI Renderer directive to render resolved child nodes.
 *
 * CRITICAL: Properties accessed via getProp() from component().properties.
 * After processMessages(), children are fully resolved AnyComponentNode[].
 */
@Component({
  selector: 'app-composite-dashboard',
  standalone: true,
  imports: [CommonModule, Renderer],
  template: `
    <div class="w-full p-4">
      <!-- Title -->
      @if (title) {
        <h2 class="text-2xl font-bold text-gray-900 mb-6">{{ title }}</h2>
      }

      <!-- Grid Container -->
      <div [class]="gridClass">
        @for (child of children; track child.id) {
          <ng-container a2ui-renderer [surfaceId]="surfaceId()!" [component]="child" />
        }
      </div>
    </div>
  `,
})
export class CompositeDashboardComponent extends CatalogBaseComponent {
  // Property getters via getProp pattern
  get title(): string | undefined {
    return this.getProp<string>('title');
  }

  get layout(): 'auto' | '2-column' | '3-column' | '1-top-2-bottom' {
    return this.getProp<any>('layout', 'auto')!;
  }

  // After tree resolution, children are fully resolved AnyComponentNode[]
  get children(): any[] {
    const raw = this.getProp<any>('children');
    return Array.isArray(raw) ? raw : [];
  }

  protected get gridClass(): string {
    const baseClasses = 'grid gap-4';

    switch (this.layout) {
      case '2-column':
        return `${baseClasses} grid-cols-1 md:grid-cols-2`;
      case '3-column':
        return `${baseClasses} grid-cols-1 md:grid-cols-2 lg:grid-cols-3`;
      case '1-top-2-bottom':
        return `${baseClasses} grid-cols-1 md:grid-cols-2 [&>*:first-child]:md:col-span-2`;
      case 'auto':
      default:
        return `${baseClasses} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`;
    }
  }
}
