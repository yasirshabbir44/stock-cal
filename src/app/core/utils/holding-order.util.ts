import { Holding } from '../models/holding.model';

export function sortHoldingsByOrder(holdings: Holding[]): Holding[] {
  return [...holdings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Assign sortOrder to holdings that lack it, preserving current array order. */
export function normalizeHoldingsSortOrder(holdings: Holding[]): Holding[] {
  return holdings.map((holding, index) => ({
    ...holding,
    sortOrder: holding.sortOrder ?? index,
  }));
}

export function nextHoldingSortOrder(holdings: Holding[]): number {
  if (holdings.length === 0) {
    return 0;
  }
  return Math.max(...holdings.map((h) => h.sortOrder ?? 0)) + 1;
}
