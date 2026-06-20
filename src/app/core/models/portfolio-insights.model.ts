export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface InsightAlert {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percent: number;
}

export interface PerformerSummary {
  ticker: string;
  growthPercent: number;
  assetValue: number;
}

export interface IncomeProjectionYear {
  year: number;
  annualIncome: number;
  monthlyIncome: number;
}

export interface PortfolioInsights {
  healthScore: number;
  healthLabel: string;
  alerts: InsightAlert[];
  sectorAllocation: SectorAllocation[];
  topGainers: PerformerSummary[];
  topLosers: PerformerSummary[];
  diversificationScore: number;
  largestHoldingPercent: number;
}
