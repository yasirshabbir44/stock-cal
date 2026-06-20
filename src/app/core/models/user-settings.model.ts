export interface UserSettings {
  id: 'settings';
  monthlyIncomeGoal: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'settings',
  monthlyIncomeGoal: 1000,
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
