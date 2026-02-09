import { Pipe, PipeTransform } from '@angular/core';

/**
 * RelativeTimePipe
 *
 * Transforms a Date into a human-readable relative time string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago"
 */
@Pipe({
  name: 'relativeTime',
  standalone: true,
})
export class RelativeTimePipe implements PipeTransform {
  transform(value: Date | string | number): string {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle future dates
    if (diffMs < 0) {
      return 'in the future';
    }

    // Less than 1 minute
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) {
      return 'just now';
    }

    // Less than 1 hour
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    // Less than 1 day
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    // Less than 1 week
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    // More than 1 week - show date
    return date.toLocaleDateString();
  }
}
