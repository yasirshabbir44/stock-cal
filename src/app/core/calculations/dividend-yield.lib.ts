export type YieldTrend = 'up' | 'down' | 'flat';

const YIELD_TREND_EPSILON = 0.005;

export function computeDividendYieldPercent(annualDps: number, price: number): number {
  if (price <= 0) {
    return 0;
  }
  return (annualDps / price) * 100;
}

export function computeYieldOnCostPercent(annualDps: number, purchasePrice: number): number {
  if (purchasePrice <= 0) {
    return 0;
  }
  return (annualDps / purchasePrice) * 100;
}

export function getYieldTrend(current: number, previous?: number): YieldTrend | null {
  if (previous == null) {
    return null;
  }

  const delta = current - previous;
  if (Math.abs(delta) < YIELD_TREND_EPSILON) {
    return 'flat';
  }

  return delta > 0 ? 'up' : 'down';
}

export function yieldTrendTitle(current: number, previous?: number): string | null {
  if (previous == null) {
    return null;
  }

  const delta = current - previous;
  if (Math.abs(delta) < YIELD_TREND_EPSILON) {
    return `Yield unchanged since last update (${previous.toFixed(2)}%)`;
  }

  const direction = delta > 0 ? 'increased' : 'decreased';
  return `Yield ${direction} from ${previous.toFixed(2)}% since last update`;
}
