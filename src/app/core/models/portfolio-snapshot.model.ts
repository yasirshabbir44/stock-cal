export interface PortfolioSnapshot {
  id: string;
  date: string;
  totalValue: number;
  /** Annual dividend income (DPS × shares) at snapshot time */
  annualDividendIncome?: number;
  /** Average yield on cost across holdings at snapshot time */
  averageYieldOnCostPercent?: number;
}
