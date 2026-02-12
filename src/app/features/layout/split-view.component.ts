import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * SplitViewComponent
 *
 * Responsive split-view layout supporting:
 * - Desktop (>=1024px): Side-by-side with draggable divider
 * - Tablet (768px-1023px): Tabbed layout
 * - Mobile (<768px): Single panel with external toggle
 *
 * CRITICAL: Uses a SINGLE ng-content per slot (Angular only projects once).
 * Responsive behavior is achieved via CSS media queries + data-attributes,
 * NOT by duplicating ng-content in separate template branches.
 */
@Component({
  selector: 'app-split-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <!-- Tablet/Mobile tab bar (hidden on desktop) -->
    <div class="lg:hidden border-b border-gray-200 flex flex-shrink-0 bg-white" role="tablist">
      <button
        role="tab"
        [attr.aria-selected]="activeTab() === 'chat'"
        aria-controls="panel-chat"
        (click)="activeTab.set('chat')"
        class="flex-1 px-6 py-3 text-sm font-medium transition-colors relative"
        [class.text-blue-600]="activeTab() === 'chat'"
        [class.text-gray-500]="activeTab() !== 'chat'">
        Chat
        @if (activeTab() === 'chat') {
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
        }
      </button>
      <button
        role="tab"
        [attr.aria-selected]="activeTab() === 'canvas'"
        aria-controls="panel-canvas"
        (click)="activeTab.set('canvas')"
        class="flex-1 px-6 py-3 text-sm font-medium transition-colors relative"
        [class.text-blue-600]="activeTab() === 'canvas'"
        [class.text-gray-500]="activeTab() !== 'canvas'">
        Canvas
        @if (activeTab() === 'canvas') {
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
        }
      </button>
    </div>

    <!-- Main content area (single ng-content per slot) -->
    <div #desktopContainer class="flex-1 flex overflow-hidden">
      <!-- Chat panel -->
      <div
        id="panel-chat"
        role="tabpanel"
        [attr.data-panel]="'chat'"
        [attr.data-active]="activeTab() === 'chat'"
        [style.width.%]="isCanvasFullscreen() ? 0 : chatWidth()"
        [hidden]="isCanvasFullscreen()"
        class="h-full overflow-hidden flex flex-col panel-wrapper">
        <ng-content select="[slot='chat']"></ng-content>
      </div>

      <!-- Draggable divider (desktop only, hidden in fullscreen) -->
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        (pointerdown)="onDividerPointerDown($event)"
        [hidden]="isCanvasFullscreen()"
        class="hidden lg:flex w-1.5 flex-shrink-0 bg-gray-200 cursor-col-resize hover:bg-blue-400 transition-colors relative z-10 items-center justify-center"
        [class.bg-blue-500]="isDragging()"
        style="touch-action: none;">
        <div
          class="flex flex-col gap-1 transition-opacity duration-150"
          [class.opacity-0]="!isDragging()"
          [class.opacity-100]="isDragging()">
          <div class="w-0.5 h-0.5 bg-white rounded-full"></div>
          <div class="w-0.5 h-0.5 bg-white rounded-full"></div>
          <div class="w-0.5 h-0.5 bg-white rounded-full"></div>
        </div>
      </div>

      <!-- Canvas panel -->
      <div
        id="panel-canvas"
        role="tabpanel"
        [attr.data-panel]="'canvas'"
        [attr.data-active]="activeTab() === 'canvas'"
        class="h-full overflow-hidden flex flex-col min-w-0 flex-1 panel-wrapper">
        <ng-content select="[slot='canvas']"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* Mobile & Tablet: only show the active panel, full width */
    @media (max-width: 1023.98px) {
      .panel-wrapper {
        width: 100% !important;
        flex: none !important;
        display: none;
      }
      .panel-wrapper[data-active="true"] {
        display: flex;
      }
    }
  `],
})
export class SplitViewComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('desktopContainer') desktopContainer?: ElementRef<HTMLElement>;

  // Signals for layout state
  readonly chatWidth = signal<number>(40); // percentage
  readonly activeTab = signal<'chat' | 'canvas'>('chat');
  readonly isDragging = signal(false);
  readonly isCanvasFullscreen = signal(false);

  // Constraints
  private readonly MIN_CHAT_WIDTH_PCT = 20;
  private readonly MAX_CHAT_WIDTH_PCT = 70;
  private readonly STORAGE_KEY = 'split-ratio';

  // Native drag state
  private startX = 0;
  private startWidth = 0;
  private containerWidth = 0;

  // Bound handlers for cleanup
  private boundPointerMove = this.onPointerMove.bind(this);
  private boundPointerUp = this.onPointerUp.bind(this);

  ngOnInit(): void {
    this.loadSplitRatio();
  }

  ngAfterViewInit(): void {
    this.updateContainerWidth();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointermove', this.boundPointerMove);
    document.removeEventListener('pointerup', this.boundPointerUp);
  }

  private onResize = (): void => {
    this.updateContainerWidth();
  };

  /**
   * Start divider drag using native pointer events
   */
  onDividerPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.updateContainerWidth();

    this.isDragging.set(true);
    this.startX = event.clientX;
    this.startWidth = this.chatWidth();

    // Capture pointer for smooth tracking even outside the element
    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    document.addEventListener('pointermove', this.boundPointerMove);
    document.addEventListener('pointerup', this.boundPointerUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) return;

    const deltaX = event.clientX - this.startX;
    const deltaPct = (deltaX / this.containerWidth) * 100;
    let newWidth = this.startWidth + deltaPct;

    // Clamp to constraints
    newWidth = Math.max(this.MIN_CHAT_WIDTH_PCT, Math.min(this.MAX_CHAT_WIDTH_PCT, newWidth));

    this.chatWidth.set(newWidth);
  }

  private onPointerUp(): void {
    this.isDragging.set(false);

    document.removeEventListener('pointermove', this.boundPointerMove);
    document.removeEventListener('pointerup', this.boundPointerUp);

    // Restore text selection and cursor
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    this.saveSplitRatio();
  }

  /**
   * Save split ratio to localStorage
   */
  private saveSplitRatio(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, this.chatWidth().toString());
    } catch (e) {
      console.warn('Failed to save split ratio to localStorage', e);
    }
  }

  /**
   * Load split ratio from localStorage
   */
  private loadSplitRatio(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const ratio = parseFloat(saved);
        if (!isNaN(ratio) && ratio >= this.MIN_CHAT_WIDTH_PCT && ratio <= this.MAX_CHAT_WIDTH_PCT) {
          this.chatWidth.set(ratio);
        }
      }
    } catch (e) {
      console.warn('Failed to load split ratio from localStorage', e);
    }
  }

  /**
   * Update tracked container width
   */
  private updateContainerWidth(): void {
    if (this.desktopContainer?.nativeElement) {
      this.containerWidth = this.desktopContainer.nativeElement.offsetWidth;
    } else {
      this.containerWidth = window.innerWidth;
    }
  }

  /**
   * Set mobile/tablet view (called by parent via ViewChild)
   * Uses activeTab signal which drives CSS visibility on smaller screens.
   */
  setMobileView(view: 'chat' | 'canvas'): void {
    this.activeTab.set(view);
  }

  toggleCanvasFullscreen(): void {
    this.isCanvasFullscreen.update((v) => !v);
  }
}
