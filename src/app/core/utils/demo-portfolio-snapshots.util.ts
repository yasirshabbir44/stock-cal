import { PortfolioSnapshot } from '../models/portfolio-snapshot.model';

export interface DemoSnapshotInput {
  currentValue: number;
  costBasis: number;
  annualDividendIncome: number;
  averageYieldOnCostPercent: number;
  days?: number;
}

/** Builds daily portfolio snapshots for demo mode so historical charts have data immediately. */
export function generateDemoPortfolioSnapshots(input: DemoSnapshotInput): PortfolioSnapshot[] {
  const days = input.days ?? 90;
  const today = new Date();
  const snapshots: PortfolioSnapshot[] = [];

  for (let offset = days; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const dateStr = date.toISOString().slice(0, 10);
    const progress = (days - offset) / days;

    const wave = Math.sin(offset * 0.45) * 0.018 + Math.cos(offset * 0.17) * 0.012;
    const growthFactor = Math.max(0, Math.min(1, progress + wave * (1 - progress * 0.6)));
    const totalValue = input.costBasis + (input.currentValue - input.costBasis) * growthFactor;

    const incomeFactor = 0.92 + growthFactor * 0.08;
    const annualDividendIncome = input.annualDividendIncome * incomeFactor;
    const averageYieldOnCostPercent = input.averageYieldOnCostPercent * (0.97 + growthFactor * 0.03);

    snapshots.push({
      id: dateStr,
      date: dateStr,
      totalValue: +totalValue.toFixed(2),
      annualDividendIncome: +annualDividendIncome.toFixed(2),
      averageYieldOnCostPercent: +averageYieldOnCostPercent.toFixed(2),
    });
  }

  return snapshots;
}
