import type { VirtualItem } from '@tanstack/angular-virtual';

/** Offset for virtualized table rows (TanStack table pattern). */
export function virtualRowTransform(virtualRow: VirtualItem, loopIndex: number): string {
  return `translateY(${virtualRow.start - loopIndex * virtualRow.size}px)`;
}
