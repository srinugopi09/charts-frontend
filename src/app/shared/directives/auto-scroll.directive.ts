import {
  Directive,
  ElementRef,
  AfterViewChecked,
  OnDestroy,
  Input,
} from '@angular/core';

/**
 * AutoScrollDirective
 *
 * Automatically scrolls an element to the bottom when content changes,
 * but only if the user hasn't manually scrolled up.
 *
 * Usage: <div appAutoScroll>...</div>
 */
@Directive({
  selector: '[appAutoScroll]',
  standalone: true,
})
export class AutoScrollDirective implements AfterViewChecked, OnDestroy {
  @Input() autoScrollEnabled = true;

  private isNearBottom = true;
  private mutationObserver?: MutationObserver;

  constructor(private elementRef: ElementRef<HTMLElement>) {
    this.setupScrollListener();
    this.setupMutationObserver();
  }

  ngAfterViewChecked(): void {
    if (this.autoScrollEnabled && this.isNearBottom) {
      this.scrollToBottom();
    }
  }

  ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
  }

  /**
   * Listen for scroll events to track if user has scrolled up
   */
  private setupScrollListener(): void {
    const element = this.elementRef.nativeElement;

    element.addEventListener('scroll', () => {
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;

      // Consider "near bottom" if within 100px of bottom
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      this.isNearBottom = distanceFromBottom < 100;
    });
  }

  /**
   * Watch for DOM mutations to trigger scroll
   */
  private setupMutationObserver(): void {
    const element = this.elementRef.nativeElement;

    this.mutationObserver = new MutationObserver(() => {
      if (this.isNearBottom) {
        this.scrollToBottom();
      }
    });

    this.mutationObserver.observe(element, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Scroll the element to the bottom
   */
  private scrollToBottom(): void {
    const element = this.elementRef.nativeElement;
    element.scrollTop = element.scrollHeight;
  }
}
