export interface UserSettings {
  id: 'settings';
  monthlyIncomeGoal: number;
  withdrawalRatePercent: number;
  finnhubApiKey?: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'settings',
  monthlyIncomeGoal: 1000,
  withdrawalRatePercent: 4,
  finnhubApiKey: '',
};

export interface PortfolioExport {
  version: 1 | 2;
  exportedAt: string;
  holdings: import('./holding.model').Holding[];
  dividendSchedules: import('./dividend-schedule.model').DividendSchedule[];
  portfolioSnapshots: import('./portfolio-snapshot.model').PortfolioSnapshot[];
  settings: UserSettings;
  watchlist?: import('./watchlist-item.model').WatchlistItem[];
}
