import { StockSuggestion } from './stock-search.model';

export type AnalysisRating = 'bullish' | 'neutral' | 'bearish' | 'caution';
export type SuggestionSeverity = 'positive' | 'neutral' | 'warning' | 'critical';

export interface StockProfile {
  symbol: string;
  name: string;
  type: string;
  sector: string;
  industry: string;
  country: string;
  exchange: string;
  ipoDate?: string;
  marketCapMillions: number;
  sharesOutstanding: number;
  website?: string;
  logoUrl?: string;
}

export interface StockFundamentals {
  currentPrice: number;
  changeAmount: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  annualDividendPerShare: number;
  dividendYieldPercent: number;
  peRatio?: number;
  eps?: number;
  payoutRatioPercent?: number;
  beta?: number;
  week52High?: number;
  week52Low?: number;
  revenueGrowthPercent?: number;
  profitMarginPercent?: number;
  operatingMarginPercent?: number;
  grossMarginPercent?: number;
  epsGrowthPercent?: number;
  dividendGrowthPercent?: number;
  debtToEquity?: number;
  currentRatio?: number;
  returnOnEquityPercent?: number;
  priceToBook?: number;
  priceToSales?: number;
}

export type HealthStatus = 'good' | 'fair' | 'poor' | 'unknown';

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  hint: string;
}

export interface HealthPillar {
  id: string;
  label: string;
  score: number;
  status: HealthStatus;
  summary: string;
}

export interface CompanyHealth {
  overallScore: number;
  overallLabel: string;
  plainSummary: string;
  pillars: HealthPillar[];
  checks: HealthCheck[];
}

export interface AnalysisTechnique {
  id: string;
  title: string;
  category: 'income' | 'valuation' | 'risk' | 'momentum' | 'quality' | 'financial';
  rating: AnalysisRating;
  summary: string;
  detail: string;
  metricLabel?: string;
  metricValue?: string;
}

export interface AnalysisSuggestion {
  id: string;
  title: string;
  message: string;
  severity: SuggestionSeverity;
  action?: string;
}

export interface StockAnalysisReport {
  suggestion: StockSuggestion;
  profile: StockProfile;
  fundamentals: StockFundamentals;
  companyHealth: CompanyHealth;
  techniques: AnalysisTechnique[];
  suggestions: AnalysisSuggestion[];
  incomeFitScore: number;
  incomeFitLabel: string;
  similarTickers: string[];
  analyzedAt: string;
}
