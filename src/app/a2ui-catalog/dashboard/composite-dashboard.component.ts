import { Component, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Renderer],
  template: `
    <div class="w-full p-4">
      <!-- Title -->
      @if (title) {
        <h2 class="text-2xl font-bold text-gray-900 mb-6">{{ title }}</h2>
      }

      <!-- KPI row: compact horizontal strip -->
      @if (kpiChildren.length) {
        <div class="flex flex-wrap gap-4 mb-6">
          @for (child of kpiChildren; track child.id) {
            <div class="flex-1 min-w-[180px]">
              <ng-container a2ui-renderer [surfaceId]="surfaceId()!" [component]="child" />
            </div>
          }
        </div>
      }

      <!-- Content grid: charts, tables, insights get more space -->
      @if (contentChildren.length) {
        <div [class]="contentGridClass">
          @for (child of contentChildren; track child.id) {
            <div>
              @if (child.properties?.title) {
                <h3 class="text-base font-semibold text-gray-800 mb-2">{{ child.properties.title }}</h3>
              }
              <ng-container a2ui-renderer [surfaceId]="surfaceId()!" [component]="child" />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CompositeDashboardComponent extends CatalogBaseComponent {
  private static readonly KPI_TYPES = new Set(['KPICard', 'RAGIndicator']);

  get title(): string | undefined {
    return this.getProp<string>('title');
  }

  get layout(): 'auto' | '2-column' | '3-column' | '1-top-2-bottom' {
    return this.getProp<any>('layout', 'auto')!;
  }

  private get children(): any[] {
    const raw = this.getProp<any>('children');
    return Array.isArray(raw) ? raw : [];
  }

  get kpiChildren(): any[] {
    return this.children.filter((c: any) => CompositeDashboardComponent.KPI_TYPES.has(c.type));
  }

  get contentChildren(): any[] {
    return this.children.filter((c: any) => !CompositeDashboardComponent.KPI_TYPES.has(c.type));
  }

  protected get contentGridClass(): string {
    const count = this.contentChildren.length;
    if (count === 1) return 'grid grid-cols-1 gap-6';
    return 'grid grid-cols-1 md:grid-cols-2 gap-6';
  }
}
