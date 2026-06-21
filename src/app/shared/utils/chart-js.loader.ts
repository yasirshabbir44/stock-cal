import type { Chart } from 'chart.js';

export type ChartJsModule = { Chart: typeof Chart };

let chartJsPromise: Promise<ChartJsModule> | null = null;

/** Lazy-loads a tree-shaken Chart.js build (line, bar, doughnut only). */
export function loadChartJs(): Promise<ChartJsModule> {
  if (!chartJsPromise) {
    chartJsPromise = import('./chart-js.registered');
  }

  return chartJsPromise;
}
