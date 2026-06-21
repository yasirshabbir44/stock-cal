import type { GridsterItem } from 'angular-gridster2';

export type HomeWidgetId =
  | 'income-goal'
  | 'portfolio-growth'
  | 'dividend-calendar'
  | 'asset-allocation'
  | 'top-holdings'
  | 'milestones'
  | 'alerts'
  | 'explore';

export interface DashboardWidgetLayout extends GridsterItem {
  id: HomeWidgetId;
}

export interface SavedDashboardLayout {
  version: 2;
  widgets: Array<Pick<DashboardWidgetLayout, 'id' | 'x' | 'y' | 'cols' | 'rows'>>;
}
