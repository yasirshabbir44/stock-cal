export interface FireProjectionYear {
  year: number;
  portfolioValue: number;
  annualIncome: number;
  monthlyIncome: number;
}

export interface FirePlanSummary {
  freedomNumber: number;
  yearsToGoal: number | null;
  monthlyGap: number;
  goalReached: boolean;
  withdrawalRatePercent: number;
}
