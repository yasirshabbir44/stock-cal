/** Audit-ready formula explanations aligned with portfolio calculation logic. */
export const METRIC_FORMULAS = {
  next30DaysDividends:
    'Sum of (dividend per share × your shares) for each scheduled payout with a pay date within the next 30 days.',

  projectedAnnualIncome:
    'Sum of (annual dividend per share × shares) across all holdings. Each holding uses the annual DPS stored with that position.',

  projectedMonthlyIncome: 'Projected Annual Income ÷ 12.',

  portfolioDividendYield:
    '(Projected Annual Income ÷ Total Portfolio Value) × 100. Portfolio value is current price × shares for each holding.',

  averageYieldOnCost:
    'Average of each holding’s yield on cost: (annual dividend per share ÷ purchase price) × 100, summed and divided by number of holdings.',

  totalPortfolioValue:
    'Sum of (current price × shares) for each holding.',

  totalCostBasis: 'Sum of (purchase price × shares) for each holding.',

  assetGrowth:
    '((Total Portfolio Value − Total Cost Basis) ÷ Total Cost Basis) × 100.',

  unrealizedGainLoss: 'Total Portfolio Value − Total Cost Basis.',

  freedomNumber:
    '(Monthly Income Goal × 12) ÷ (Withdrawal Rate ÷ 100). This is the portfolio size needed to support your target income at the chosen safe withdrawal rate.',

  yearsToGoal:
    'Years until projected monthly income reaches your goal, based on your scenario assumptions: monthly contributions, dividend growth rate, and portfolio return rate.',

  portfolioHealthScore:
    'Weighted blend of diversification (50%), dividend yield fit (up to 20 pts), growth (up to 15 pts), holding count (up to 10 pts), and largest position size (up to 5 pts). Score is 0–100.',

  incomeFitScore:
    'Composite score (0–100) based on dividend yield, payout sustainability, dividend growth history, and company health for income-focused investing.',
} as const;
