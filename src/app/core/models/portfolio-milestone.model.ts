export type MilestoneCategory = 'wealth' | 'income' | 'portfolio';

export interface PortfolioMilestone {
  id: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  achieved: boolean;
  progress: number;
  target: number;
  current: number;
}
