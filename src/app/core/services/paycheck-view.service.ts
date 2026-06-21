import { Injectable, signal } from '@angular/core';

export type DividendChartGranularity = 'monthly' | 'yearly';

@Injectable({ providedIn: 'root' })
export class PaycheckViewService {
  readonly dividendChartGranularity = signal<DividendChartGranularity>('monthly');

  setDividendChartGranularity(granularity: DividendChartGranularity): void {
    this.dividendChartGranularity.set(granularity);
  }

  toggleDividendChartGranularity(): void {
    this.dividendChartGranularity.update((g) => (g === 'monthly' ? 'yearly' : 'monthly'));
  }
}
