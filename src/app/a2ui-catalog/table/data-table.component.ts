import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogBaseComponent } from '../catalog-base.component';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';

interface TableColumn {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date';
}

/**
 * DataTableComponent
 *
 * Sortable, paginated data table with responsive layout.
 * Features:
 * - Column sorting (ascending/descending)
 * - Pagination
 * - Responsive: card view on mobile, table on desktop
 * - Click row to drill down
 *
 * CRITICAL: Properties accessed via getProp() from component().properties.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div [class]="isModern ? 'w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden' : 'w-full bg-white rounded-lg border border-gray-200'">
      <!-- Title -->
      @if (title) {
        <div [class]="isModern ? 'px-6 py-4 border-b border-gray-100' : 'px-4 py-3 border-b border-gray-200'">
          <h3 [class]="isModern ? 'text-lg font-bold text-gray-900 tracking-tight' : 'text-lg font-semibold text-gray-800'">{{ title }}</h3>
        </div>
      }

      <!-- Desktop Table View -->
      <div class="hidden md:block overflow-x-auto" [style.max-height]="maxHeight">
        <table class="w-full">
          <thead [class]="isModern ? 'bg-gray-50/70 sticky top-0' : 'bg-gray-50 border-b border-gray-200 sticky top-0'">
            <tr>
              @for (column of columns; track column.key) {
                <th
                  scope="col"
                  [attr.aria-sort]="sortColumn() === column.key ? (sortDirection() === 'asc' ? 'ascending' : 'descending') : null"
                  [class]="isModern
                    ? 'px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 transition-colors'
                    : 'px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors'"
                  (click)="sortable ? toggleSort(column.key) : null">
                  <div class="flex items-center gap-2">
                    <span>{{ column.label }}</span>
                    @if (sortable && sortColumn() === column.key) {
                      <svg
                        [class]="isModern ? 'w-3.5 h-3.5 text-indigo-500' : 'w-4 h-4'"
                        [class.rotate-180]="sortDirection() === 'desc'"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                      </svg>
                    }
                  </div>
                </th>
              }
            </tr>
          </thead>
          <tbody [class]="isModern ? 'divide-y divide-gray-50' : 'divide-y divide-gray-200'">
            @for (row of displayedRows(); track $index) {
              <tr
                (click)="handleRowClick(row)"
                [class]="isModern
                  ? 'hover:bg-indigo-50/40 cursor-pointer transition-colors duration-150'
                  : 'hover:bg-gray-50 cursor-pointer transition-colors'">
                @for (column of columns; track column.key) {
                  <td [class]="isModern
                    ? 'px-6 py-4 text-sm ' + (column.type === 'number' ? 'text-gray-900 font-medium tabular-nums' : 'text-gray-600')
                    : 'px-4 py-3 text-sm text-gray-900'">
                    {{ formatCellValue(row[column.key], column.type) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile Card View -->
      <div [class]="isModern ? 'md:hidden divide-y divide-gray-50' : 'md:hidden divide-y divide-gray-200'">
        @for (row of displayedRows(); track $index) {
          <div
            (click)="handleRowClick(row)"
            [class]="isModern
              ? 'px-6 py-4 hover:bg-indigo-50/40 cursor-pointer transition-colors duration-150'
              : 'p-4 hover:bg-gray-50 cursor-pointer transition-colors'">
            @for (column of columns; track column.key) {
              <div class="flex justify-between py-1">
                <span [class]="isModern ? 'text-xs font-semibold text-gray-400 uppercase tracking-wider' : 'text-xs font-medium text-gray-600'">{{ column.label }}</span>
                <span [class]="isModern
                  ? 'text-sm ' + (column.type === 'number' ? 'text-gray-900 font-medium tabular-nums' : 'text-gray-600')
                  : 'text-sm text-gray-900'">
                  {{ formatCellValue(row[column.key], column.type) }}
                </span>
              </div>
            }
          </div>
        }
      </div>

      <!-- Pagination -->
      @if (rows && rows.length > pageSize) {
        <div [class]="isModern
          ? 'px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50'
          : 'px-4 py-3 border-t border-gray-200 flex items-center justify-between'">
          <div [class]="isModern ? 'text-sm text-gray-500' : 'text-sm text-gray-700'">
            Showing {{ (currentPage() - 1) * pageSize + 1 }} to
            {{ Math.min(currentPage() * pageSize, rows.length) }} of {{ rows.length }} results
          </div>
          <div class="flex gap-2">
            <button
              (click)="previousPage()"
              [disabled]="currentPage() === 1"
              [class]="isModern
                ? 'px-4 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-white hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150'
                : 'px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'">
              Previous
            </button>
            <button
              (click)="nextPage()"
              [disabled]="currentPage() >= totalPages()"
              [class]="isModern
                ? 'px-4 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-white hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150'
                : 'px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'">
              Next
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DataTableComponent extends CatalogBaseComponent {
  get isModern(): boolean {
    return FEATURE_FLAGS.MODERN_CHART_STYLE;
  }

  // Property getters via getProp pattern
  get title(): string | undefined {
    return this.getProp<string>('title');
  }

  get columns(): TableColumn[] {
    return this.getProp<TableColumn[]>('columns', [])!;
  }

  private readonly _rows = computed(() => {
    const rawRows = this.getProp<any[]>('rows', [])!;
    if (!rawRows || rawRows.length === 0) return [];

    // Backend may send rows as positional arrays (e.g. [["Product A", 100000]])
    // instead of keyed objects. Convert using column keys.
    if (Array.isArray(rawRows[0])) {
      const cols = this.columns;
      return rawRows.map((row: any[]) => {
        const obj: Record<string, any> = {};
        cols.forEach((col, i) => {
          obj[col.key] = i < row.length ? row[i] : undefined;
        });
        return obj;
      });
    }

    return rawRows as Record<string, any>[];
  });

  get rows(): Record<string, any>[] {
    return this._rows();
  }

  get sortable(): boolean {
    return this.getProp<boolean>('sortable', true)!;
  }

  get filterable(): boolean {
    return this.getProp<boolean>('filterable', false)!;
  }

  get pageSize(): number {
    return this.getProp<number>('pageSize', 10)!;
  }

  get maxHeight(): string {
    return this.getProp<string>('maxHeight', '600px')!;
  }

  // Local state
  protected readonly sortColumn = signal<string | null>(null);
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');
  protected readonly currentPage = signal<number>(1);

  // Expose Math for template
  protected readonly Math = Math;

  /**
   * Computed: sorted and paginated rows
   */
  protected readonly displayedRows = computed(() => {
    const allRows = this.rows;
    if (!allRows || allRows.length === 0) return [];

    let result = [...allRows];

    // Apply sorting
    if (this.sortable && this.sortColumn()) {
      const column = this.sortColumn()!;
      const direction = this.sortDirection();

      result.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        if (aVal === bVal) return 0;
        const comparison = aVal > bVal ? 1 : -1;
        return direction === 'asc' ? comparison : -comparison;
      });
    }

    // Apply pagination
    const ps = this.pageSize;
    const start = (this.currentPage() - 1) * ps;
    const end = start + ps;
    return result.slice(start, end);
  });

  /**
   * Computed: total pages
   */
  protected readonly totalPages = computed(() => {
    const allRows = this.rows;
    if (!allRows) return 1;
    return Math.ceil(allRows.length / this.pageSize);
  });

  protected toggleSort(columnKey: string): void {
    if (this.sortColumn() === columnKey) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(columnKey);
      this.sortDirection.set('asc');
    }
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((page) => page + 1);
    }
  }

  protected previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((page) => page - 1);
    }
  }

  protected formatCellValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '—';
    switch (type) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'date':
        return value instanceof Date ? value.toLocaleDateString() : String(value);
      default:
        return String(value);
    }
  }

  get interactive(): boolean {
    if (!FEATURE_FLAGS.DRILL_DOWN_ENABLED) return false;
    return this.getProp<boolean>('interactive', true)!;
  }

  protected handleRowClick(row: Record<string, any>): void {
    if (!this.interactive) return;
    this.sendAction({
      name: 'drill_down',
      context: [
        { key: 'row', value: { literalString: JSON.stringify(row) } },
      ],
    } as any);
  }
}
