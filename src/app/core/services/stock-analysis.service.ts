import { Injectable, inject } from '@angular/core';
import { POPULAR_STOCKS } from '../constants/popular-stocks';
import { getSectorForTicker } from '../constants/stock-sectors';
import {
  AnalysisRating,
  AnalysisSuggestion,
  AnalysisTechnique,
  CompanyHealth,
  HealthCheck,
  HealthPillar,
  HealthStatus,
  StockAnalysisReport,
  StockFundamentals,
  StockProfile,
} from '../models/stock-analysis.model';
import { StockSuggestion } from '../models/stock-search.model';
import { StockApiService } from './stock-api.service';

const SECTOR_YIELD_BENCHMARKS: Record<string, number> = {
  Technology: 0.8,
  Healthcare: 1.5,
  'Consumer Defensive': 2.5,
  'Consumer Cyclical': 1.2,
  'Financial Services': 2.8,
  Energy: 3.5,
  Utilities: 3.2,
  'Real Estate': 4.5,
  'ETF / Fund': 2.8,
  Industrials: 1.8,
  'Communication Services': 2.0,
  'Basic Materials': 2.2,
  Other: 2.0,
};

const SIMILAR_BY_SECTOR: Record<string, string[]> = {
  Technology: ['MSFT', 'AAPL', 'GOOGL', 'NVDA'],
  Healthcare: ['JNJ', 'ABBV', 'UNH'],
  'Consumer Defensive': ['KO', 'PG', 'PEP'],
  'Financial Services': ['JPM', 'V', 'MAIN'],
  'Real Estate': ['O', 'PLD', 'VNQ'],
  'ETF / Fund': ['SCHD', 'VYM', 'SPY', 'VTI'],
  Energy: ['XOM', 'CVX'],
  Utilities: ['NEE', 'DUK'],
};

@Injectable({ providedIn: 'root' })
export class StockAnalysisService {
  private readonly stockApi = inject(StockApiService);

  async analyze(
    ticker: string,
    selected?: StockSuggestion | null,
    portfolioTickers: string[] = [],
  ): Promise<StockAnalysisReport> {
    const symbol = ticker.toUpperCase().trim();
    const [profile, fundamentals] = await Promise.all([
      this.stockApi.fetchProfile(symbol),
      this.stockApi.fetchFundamentals(symbol),
    ]);

    const suggestion: StockSuggestion = selected ?? {
      symbol,
      name: profile.name,
      type: profile.type,
      logoUrl: profile.logoUrl,
    };

    const techniques = this.buildTechniques(profile, fundamentals);
    const incomeFitScore = this.computeIncomeFitScore(profile, fundamentals, techniques);
    const companyHealth = this.buildCompanyHealth(profile, fundamentals);
    const suggestions = this.buildSuggestions(
      profile,
      fundamentals,
      techniques,
      incomeFitScore,
      companyHealth,
      portfolioTickers,
    );

    return {
      suggestion,
      profile,
      fundamentals,
      companyHealth,
      techniques,
      suggestions,
      incomeFitScore,
      incomeFitLabel: this.incomeFitLabel(incomeFitScore),
      similarTickers: this.similarTickers(symbol, profile.sector),
      analyzedAt: new Date().toISOString(),
    };
  }

  private buildTechniques(profile: StockProfile, f: StockFundamentals): AnalysisTechnique[] {
    const techniques: AnalysisTechnique[] = [];

    techniques.push(this.dividendYieldTechnique(profile, f));
    techniques.push(this.payoutRatioTechnique(f));
    techniques.push(this.valuationTechnique(f));
    techniques.push(this.momentumTechnique(f));
    techniques.push(this.riskTechnique(f));
    techniques.push(this.qualityTechnique(f));
    techniques.push(this.financialStrengthTechnique(f));
    techniques.push(this.liquidityTechnique(f));

    if (profile.type === 'ETF' || profile.type === 'REIT') {
      techniques.push(this.vehicleTechnique(profile, f));
    }

    return techniques;
  }

  private dividendYieldTechnique(profile: StockProfile, f: StockFundamentals): AnalysisTechnique {
    const benchmark = SECTOR_YIELD_BENCHMARKS[profile.sector] ?? 2.0;
    const yieldPct = f.dividendYieldPercent;

    let rating: AnalysisRating = 'neutral';
    let summary = '';
    let detail = '';

    if (yieldPct === 0) {
      rating = profile.type === 'Common Stock' && profile.sector === 'Technology' ? 'neutral' : 'bearish';
      summary = 'No meaningful dividend income';
      detail =
        `${profile.symbol} pays little or no dividend. This stock is better evaluated for capital appreciation than passive income. Income-focused portfolios may want to look at dividend ETFs like SCHD or VYM, or dividend aristocrats like JNJ or KO.`;
    } else if (yieldPct >= benchmark * 2) {
      rating = 'caution';
      summary = 'High yield — verify sustainability';
      detail =
        `At ${yieldPct.toFixed(2)}%, the yield is well above the ${profile.sector} sector average (~${benchmark}%). High yields can signal a dividend trap if the payout is unsustainable or the price has fallen sharply. Check payout ratio and dividend history before relying on this income.`;
    } else if (yieldPct >= benchmark * 1.2) {
      rating = 'bullish';
      summary = 'Above-average income for its sector';
      detail =
        `Yield of ${yieldPct.toFixed(2)}% exceeds the typical ${profile.sector} benchmark of ~${benchmark}%. For income investors, this offers competitive cash flow relative to peers while staying within a reasonable range.`;
    } else if (yieldPct >= benchmark * 0.7) {
      rating = 'neutral';
      summary = 'Yield in line with sector norms';
      detail =
        `The ${yieldPct.toFixed(2)}% yield sits near the ${profile.sector} sector average (~${benchmark}%). Suitable as part of a diversified income portfolio but not a standout yield play on its own.`;
    } else {
      rating = 'neutral';
      summary = 'Below-average yield';
      detail =
        `At ${yieldPct.toFixed(2)}%, dividend income is modest compared to the ${profile.sector} sector (~${benchmark}%). Better suited for growth or total-return strategies than pure income generation.`;
    }

    return {
      id: 'dividend-yield',
      title: 'Dividend Yield Analysis',
      category: 'income',
      rating,
      summary,
      detail,
      metricLabel: 'Indicated Yield',
      metricValue: `${yieldPct.toFixed(2)}%`,
    };
  }

  private payoutRatioTechnique(f: StockFundamentals): AnalysisTechnique {
    const payout = f.payoutRatioPercent;

    if (payout == null || f.annualDividendPerShare === 0) {
      return {
        id: 'payout-ratio',
        title: 'Payout Ratio Check',
        category: 'income',
        rating: 'neutral',
        summary: 'Not applicable — no dividend payout',
        detail:
          'Without a dividend, payout ratio analysis does not apply. Focus on earnings growth and free cash flow if evaluating for future dividend initiation.',
      };
    }

    let rating: AnalysisRating = 'neutral';
    let summary = '';
    let detail = '';

    if (payout > 100) {
      rating = 'caution';
      summary = 'Payout exceeds earnings — sustainability risk';
      detail =
        `A payout ratio of ${payout.toFixed(0)}% means the company pays out more than it earns. REITs and some trusts use different accounting, but for most stocks this raises red flags about dividend cuts over time.`;
    } else if (payout > 75) {
      rating = 'caution';
      summary = 'High payout leaves little room for error';
      detail =
        `At ${payout.toFixed(0)}%, most earnings go to shareholders. A downturn in profits could force a dividend reduction. Income investors should monitor earnings trends closely.`;
    } else if (payout >= 40 && payout <= 75) {
      rating = 'bullish';
      summary = 'Healthy payout with growth potential';
      detail =
        `A ${payout.toFixed(0)}% payout ratio balances returning cash to shareholders with retaining earnings for growth. This is a sweet spot many dividend growth investors target.`;
    } else if (payout >= 20) {
      rating = 'bullish';
      summary = 'Conservative payout — room to grow dividends';
      detail =
        `Only ${payout.toFixed(0)}% of earnings are paid out, leaving substantial retained earnings. Companies in this range often have long runway for dividend increases.`;
    } else {
      rating = 'neutral';
      summary = 'Very low payout — growth-focused';
      detail =
        `At ${payout.toFixed(0)}%, the company prioritizes reinvestment over dividends. Good for total return, but income yield may stay low unless payout policy changes.`;
    }

    return {
      id: 'payout-ratio',
      title: 'Payout Ratio Check',
      category: 'income',
      rating,
      summary,
      detail,
      metricLabel: 'Payout Ratio',
      metricValue: `${payout.toFixed(0)}%`,
    };
  }

  private valuationTechnique(f: StockFundamentals): AnalysisTechnique {
    const pe = f.peRatio;

    if (pe == null || pe <= 0) {
      return {
        id: 'valuation',
        title: 'P/E Valuation',
        category: 'valuation',
        rating: 'neutral',
        summary: 'P/E not available or negative earnings',
        detail:
          'Price-to-earnings ratio cannot be computed when earnings are negative or unavailable. Use other metrics like price-to-book, EV/EBITDA, or compare against sector peers manually.',
      };
    }

    let rating: AnalysisRating = 'neutral';
    let summary = '';
    let detail = '';

    if (pe > 40) {
      rating = 'caution';
      summary = 'Premium valuation — high growth expectations priced in';
      detail =
        `A P/E of ${pe.toFixed(1)}x suggests the market expects strong future growth. For income investors, high multiples mean lower initial yield and more downside risk if growth disappoints.`;
    } else if (pe > 25) {
      rating = 'neutral';
      summary = 'Above-market valuation';
      detail =
        `At ${pe.toFixed(1)}x earnings, ${pe > 20 ? 'the stock trades at a premium to the broad market (~20x). Justified if growth and quality are above average.' : 'valuation is moderate.'}`;
    } else if (pe >= 12) {
      rating = 'bullish';
      summary = 'Reasonable valuation';
      detail =
        `P/E of ${pe.toFixed(1)}x is in a fair range for established companies. Combines accessible entry point with earnings-backed dividend capacity.`;
    } else {
      rating = 'bullish';
      summary = 'Value territory';
      detail =
        `At ${pe.toFixed(1)}x earnings, the stock appears cheap on a earnings basis. Verify whether low P/E reflects a genuine bargain or underlying business problems.`;
    }

    return {
      id: 'valuation',
      title: 'P/E Valuation',
      category: 'valuation',
      rating,
      summary,
      detail,
      metricLabel: 'P/E Ratio',
      metricValue: `${pe.toFixed(1)}x`,
    };
  }

  private momentumTechnique(f: StockFundamentals): AnalysisTechnique {
    if (!f.week52High || !f.week52Low || f.currentPrice <= 0) {
      return {
        id: 'momentum',
        title: '52-Week Price Position',
        category: 'momentum',
        rating: 'neutral',
        summary: '52-week range data unavailable',
        detail: 'Without 52-week high/low data, momentum analysis is limited. Watch daily price action and broader market trends.',
      };
    }

    const range = f.week52High - f.week52Low;
    const position = range > 0 ? ((f.currentPrice - f.week52Low) / range) * 100 : 50;
    const fromHigh = ((f.currentPrice - f.week52High) / f.week52High) * 100;

    let rating: AnalysisRating = 'neutral';
    let summary = '';
    let detail = '';

    if (position >= 85) {
      rating = 'caution';
      summary = 'Trading near 52-week highs';
      detail =
        `Price is ${position.toFixed(0)}% through its 52-week range, only ${Math.abs(fromHigh).toFixed(1)}% below the high of $${f.week52High.toFixed(2)}. Consider waiting for a pullback or dollar-cost averaging rather than a lump-sum entry at elevated levels.`;
    } else if (position <= 25) {
      rating = 'bullish';
      summary = 'Near 52-week lows — potential entry zone';
      detail =
        `Trading at ${position.toFixed(0)}% of its 52-week range (low: $${f.week52Low.toFixed(2)}). If fundamentals remain intact, this may be an attractive accumulation zone for long-term income investors.`;
    } else if (position <= 50) {
      rating = 'bullish';
      summary = 'Below midpoint of annual range';
      detail =
        `At ${position.toFixed(0)}% of the 52-week range, the stock sits in the lower half. Balanced risk/reward for new positions — not at extremes.`;
    } else {
      rating = 'neutral';
      summary = 'Mid-range price momentum';
      detail =
        `Price is ${position.toFixed(0)}% through its 52-week range ($${f.week52Low.toFixed(2)} – $${f.week52High.toFixed(2)}). No strong momentum signal — evaluate based on fundamentals and income needs.`;
    }

    return {
      id: 'momentum',
      title: '52-Week Price Position',
      category: 'momentum',
      rating,
      summary,
      detail,
      metricLabel: 'Range Position',
      metricValue: `${position.toFixed(0)}%`,
    };
  }

  private riskTechnique(f: StockFundamentals): AnalysisTechnique {
    const beta = f.beta;

    if (beta == null) {
      return {
        id: 'risk',
        title: 'Beta & Volatility',
        category: 'risk',
        rating: 'neutral',
        summary: 'Beta data unavailable',
        detail: 'Without beta, assess volatility by reviewing price swings over the past year and comparing to SPY or your portfolio average.',
      };
    }

    let rating: AnalysisRating = 'neutral';
    let summary = '';
    let detail = '';

    if (beta > 1.3) {
      rating = 'caution';
      summary = 'High volatility vs. market';
      detail =
        `Beta of ${beta.toFixed(2)} means the stock typically moves ${(beta * 100).toFixed(0)}% as much as the market. Higher swings can mean larger drawdowns — size positions accordingly in an income portfolio.`;
    } else if (beta > 1.0) {
      rating = 'neutral';
      summary = 'Moderately volatile';
      detail =
        `Beta ${beta.toFixed(2)} indicates slightly above-market volatility. Acceptable for core holdings if dividend quality is strong.`;
    } else if (beta >= 0.7) {
      rating = 'bullish';
      summary = 'Defensive profile';
      detail =
        `Beta of ${beta.toFixed(2)} suggests below-market volatility — the stock tends to move less than the S&P 500. Attractive for conservative income portfolios seeking stability.`;
    } else {
      rating = 'bullish';
      summary = 'Low volatility — stable income candidate';
      detail =
        `Beta ${beta.toFixed(2)} indicates very low market sensitivity. Often found in utilities, staples, and healthcare — ideal for paycheck-style dividend portfolios.`;
    }

    return {
      id: 'risk',
      title: 'Beta & Volatility',
      category: 'risk',
      rating,
      summary,
      detail,
      metricLabel: 'Beta',
      metricValue: beta.toFixed(2),
    };
  }

  private qualityTechnique(f: StockFundamentals): AnalysisTechnique {
    const margin = f.profitMarginPercent;
    const growth = f.revenueGrowthPercent;

    if (margin == null && growth == null) {
      return {
        id: 'quality',
        title: 'Business Quality',
        category: 'quality',
        rating: 'neutral',
        summary: 'Limited quality metrics available',
        detail: 'Review annual reports for revenue trends, debt levels, and competitive moat when automated quality data is unavailable.',
      };
    }

    let score = 0;
    if (margin != null) {
      if (margin > 20) score += 2;
      else if (margin > 10) score += 1;
      else if (margin < 0) score -= 2;
    }
    if (growth != null) {
      if (growth > 10) score += 2;
      else if (growth > 3) score += 1;
      else if (growth < 0) score -= 1;
    }

    let rating: AnalysisRating = 'neutral';
    if (score >= 3) rating = 'bullish';
    else if (score <= -1) rating = 'caution';

    const parts: string[] = [];
    if (margin != null) parts.push(`profit margin ${margin.toFixed(1)}%`);
    if (growth != null) parts.push(`revenue growth ${growth.toFixed(1)}% (3Y)`);

    return {
      id: 'quality',
      title: 'Business Quality',
      category: 'quality',
      rating,
      summary: score >= 3 ? 'Strong fundamentals' : score <= -1 ? 'Weak quality signals' : 'Mixed quality profile',
      detail:
        `Based on ${parts.join(' and ')}, the business ${score >= 3 ? 'shows healthy profitability and growth — supportive of sustained dividends.' : score <= -1 ? 'faces headwinds that could pressure future payouts.' : 'has a mixed profile — dig deeper into balance sheet and competitive position.'}`,
      metricLabel: margin != null ? 'Profit Margin' : 'Rev. Growth',
      metricValue: margin != null ? `${margin.toFixed(1)}%` : growth != null ? `${growth.toFixed(1)}%` : '—',
    };
  }

  private vehicleTechnique(profile: StockProfile, f: StockFundamentals): AnalysisTechnique {
    const isEtf = profile.type === 'ETF';
    const rating: AnalysisRating = isEtf ? 'bullish' : 'neutral';

    return {
      id: 'vehicle',
      title: isEtf ? 'ETF Diversification Benefit' : 'REIT Income Structure',
      category: 'income',
      rating,
      summary: isEtf ? 'Instant diversification in one ticker' : 'REITs pass through rental income',
      detail: isEtf
        ? `${profile.symbol} bundles many holdings into a single position — reducing single-stock risk. ETFs like SCHD and VYM are popular core building blocks for dividend portfolios. Expense ratio and holdings overlap with existing positions should be checked.`
        : `REITs like ${profile.symbol} must distribute most taxable income to shareholders, often yielding more than typical stocks. Tax treatment differs (1099-DIV), and payout ratios above 100% are common due to FFO vs. GAAP earnings.`,
      metricLabel: 'Type',
      metricValue: profile.type,
    };
  }

  private financialStrengthTechnique(f: StockFundamentals): AnalysisTechnique {
    const dte = f.debtToEquity;
    const roe = f.returnOnEquityPercent;

    if (dte == null && roe == null) {
      return {
        id: 'financial-strength',
        title: 'Balance Sheet Strength',
        category: 'financial',
        rating: 'neutral',
        summary: 'Limited balance sheet data',
        detail: 'Debt and return-on-equity data unavailable. Check the latest 10-K filing for total debt, cash, and equity trends.',
      };
    }

    let rating: AnalysisRating = 'neutral';
    let summary = 'Moderate financial footing';
    const parts: string[] = [];

    if (dte != null) {
      if (dte > 2) {
        rating = 'caution';
        summary = 'High debt load';
        parts.push(`Debt-to-equity of ${dte.toFixed(2)} is elevated — more leverage means higher risk in downturns.`);
      } else if (dte < 0.8) {
        rating = 'bullish';
        summary = 'Conservative balance sheet';
        parts.push(`Low debt-to-equity (${dte.toFixed(2)}) suggests manageable leverage and financial flexibility.`);
      } else {
        parts.push(`Debt-to-equity of ${dte.toFixed(2)} is within a typical range for established companies.`);
      }
    }

    if (roe != null) {
      if (roe > 15) parts.push(`Strong ROE of ${roe.toFixed(1)}% indicates efficient use of shareholder capital.`);
      else if (roe < 8) parts.push(`ROE of ${roe.toFixed(1)}% is below average — capital may not be deployed efficiently.`);
    }

    return {
      id: 'financial-strength',
      title: 'Balance Sheet Strength',
      category: 'financial',
      rating,
      summary,
      detail: parts.join(' ') || 'Review annual report for debt maturity schedule and cash reserves.',
      metricLabel: dte != null ? 'Debt/Equity' : 'ROE',
      metricValue: dte != null ? dte.toFixed(2) : roe != null ? `${roe.toFixed(1)}%` : '—',
    };
  }

  private liquidityTechnique(f: StockFundamentals): AnalysisTechnique {
    const ratio = f.currentRatio;

    if (ratio == null) {
      return {
        id: 'liquidity',
        title: 'Liquidity Check',
        category: 'financial',
        rating: 'neutral',
        summary: 'Current ratio unavailable',
        detail: 'Liquidity measures whether a company can cover short-term obligations. Check cash flow from operations in quarterly reports.',
      };
    }

    let rating: AnalysisRating = 'neutral';
    let summary = '';
    let detail = '';

    if (ratio >= 1.5) {
      rating = 'bullish';
      summary = 'Strong short-term liquidity';
      detail = `Current ratio of ${ratio.toFixed(2)} means current assets comfortably cover current liabilities — a healthy cushion for operations and dividends.`;
    } else if (ratio >= 1.0) {
      rating = 'neutral';
      summary = 'Adequate liquidity';
      detail = `Current ratio of ${ratio.toFixed(2)} is acceptable but leaves limited buffer. Monitor quarterly cash flow for any deterioration.`;
    } else {
      rating = 'caution';
      summary = 'Tight liquidity';
      detail = `Current ratio below 1.0 (${ratio.toFixed(2)}) may signal difficulty meeting near-term obligations — a red flag for dividend reliability.`;
    }

    return {
      id: 'liquidity',
      title: 'Liquidity Check',
      category: 'financial',
      rating,
      summary,
      detail,
      metricLabel: 'Current Ratio',
      metricValue: ratio.toFixed(2),
    };
  }

  private buildCompanyHealth(profile: StockProfile, f: StockFundamentals): CompanyHealth {
    const pillars = this.buildHealthPillars(profile, f);
    const checks = this.buildHealthChecks(profile, f);
    const overallScore = Math.round(pillars.reduce((sum, p) => sum + p.score, 0) / pillars.length);

    return {
      overallScore,
      overallLabel: this.healthLabel(overallScore),
      plainSummary: this.buildPlainSummary(profile, f, overallScore, pillars, checks),
      pillars,
      checks,
    };
  }

  private buildHealthPillars(profile: StockProfile, f: StockFundamentals): HealthPillar[] {
    const dividendScore = this.scoreDividendSafety(f, profile);
    const financialScore = this.scoreFinancialStrength(f);
    const profitabilityScore = this.scoreProfitability(f);
    const growthScore = this.scoreGrowth(f);
    const stabilityScore = this.scoreStability(f, profile);

    return [
      {
        id: 'dividend',
        label: 'Dividend Safety',
        score: dividendScore,
        status: this.scoreToStatus(dividendScore),
        summary: this.pillarSummary('dividend', dividendScore, f),
      },
      {
        id: 'financial',
        label: 'Financial Strength',
        score: financialScore,
        status: this.scoreToStatus(financialScore),
        summary: this.pillarSummary('financial', financialScore, f),
      },
      {
        id: 'profitability',
        label: 'Profitability',
        score: profitabilityScore,
        status: this.scoreToStatus(profitabilityScore),
        summary: this.pillarSummary('profitability', profitabilityScore, f),
      },
      {
        id: 'growth',
        label: 'Growth',
        score: growthScore,
        status: this.scoreToStatus(growthScore),
        summary: this.pillarSummary('growth', growthScore, f),
      },
      {
        id: 'stability',
        label: 'Stability',
        score: stabilityScore,
        status: this.scoreToStatus(stabilityScore),
        summary: this.pillarSummary('stability', stabilityScore, f),
      },
    ];
  }

  private buildHealthChecks(profile: StockProfile, f: StockFundamentals): HealthCheck[] {
    const checks: HealthCheck[] = [];

    checks.push({
      id: 'pays-dividend',
      label: 'Pays a dividend',
      status: f.annualDividendPerShare > 0 ? 'good' : profile.type === 'ETF' ? 'fair' : 'poor',
      hint: f.annualDividendPerShare > 0
        ? `$${f.annualDividendPerShare.toFixed(2)}/share annually`
        : 'No dividend — growth-focused',
    });

    if (f.payoutRatioPercent != null && f.annualDividendPerShare > 0) {
      checks.push({
        id: 'payout-safe',
        label: 'Sustainable payout ratio',
        status: f.payoutRatioPercent <= 75 ? 'good' : f.payoutRatioPercent <= 100 ? 'fair' : 'poor',
        hint: `${f.payoutRatioPercent.toFixed(0)}% of earnings paid out`,
      });
    }

    if (f.debtToEquity != null) {
      checks.push({
        id: 'low-debt',
        label: 'Manageable debt levels',
        status: f.debtToEquity < 1 ? 'good' : f.debtToEquity < 2 ? 'fair' : 'poor',
        hint: `Debt/equity: ${f.debtToEquity.toFixed(2)}`,
      });
    }

    if (f.currentRatio != null) {
      checks.push({
        id: 'liquidity',
        label: 'Healthy liquidity',
        status: f.currentRatio >= 1.5 ? 'good' : f.currentRatio >= 1 ? 'fair' : 'poor',
        hint: `Current ratio: ${f.currentRatio.toFixed(2)}`,
      });
    }

    if (f.profitMarginPercent != null) {
      checks.push({
        id: 'margins',
        label: 'Strong profit margins',
        status: f.profitMarginPercent >= 15 ? 'good' : f.profitMarginPercent >= 8 ? 'fair' : 'poor',
        hint: `Net margin: ${f.profitMarginPercent.toFixed(1)}%`,
      });
    }

    if (f.revenueGrowthPercent != null) {
      checks.push({
        id: 'revenue-growth',
        label: 'Growing revenue',
        status: f.revenueGrowthPercent >= 5 ? 'good' : f.revenueGrowthPercent >= 0 ? 'fair' : 'poor',
        hint: `3Y growth: ${f.revenueGrowthPercent >= 0 ? '+' : ''}${f.revenueGrowthPercent.toFixed(1)}%`,
      });
    }

    if (f.beta != null) {
      checks.push({
        id: 'low-volatility',
        label: 'Below-average volatility',
        status: f.beta < 0.9 ? 'good' : f.beta <= 1.2 ? 'fair' : 'poor',
        hint: `Beta: ${f.beta.toFixed(2)}`,
      });
    }

    if (f.peRatio != null && f.peRatio > 0) {
      checks.push({
        id: 'fair-value',
        label: 'Reasonable valuation',
        status: f.peRatio <= 25 ? 'good' : f.peRatio <= 35 ? 'fair' : 'poor',
        hint: `P/E: ${f.peRatio.toFixed(1)}x`,
      });
    }

    if (f.dividendGrowthPercent != null && f.annualDividendPerShare > 0) {
      checks.push({
        id: 'div-growth',
        label: 'Growing dividends',
        status: f.dividendGrowthPercent >= 5 ? 'good' : f.dividendGrowthPercent >= 0 ? 'fair' : 'poor',
        hint: `5Y div growth: ${f.dividendGrowthPercent >= 0 ? '+' : ''}${f.dividendGrowthPercent.toFixed(1)}%`,
      });
    }

    return checks;
  }

  private buildPlainSummary(
    profile: StockProfile,
    f: StockFundamentals,
    overallScore: number,
    pillars: HealthPillar[],
    checks: HealthCheck[],
  ): string {
    const good = checks.filter((c) => c.status === 'good').length;
    const poor = checks.filter((c) => c.status === 'poor').length;
    const weakest = [...pillars].sort((a, b) => a.score - b.score)[0];
    const strongest = [...pillars].sort((a, b) => b.score - a.score)[0];

    let summary = `${profile.name} (${profile.symbol}) has an overall company health score of ${overallScore}/100 — ${this.healthLabel(overallScore).toLowerCase()}. `;

    if (good >= 5) {
      summary += `It passes ${good} of ${checks.length} health checks, showing solid fundamentals. `;
    } else if (poor >= 3) {
      summary += `${poor} health checks flagged concerns — review carefully before investing. `;
    } else {
      summary += `Health is mixed with ${good} strengths and some areas to watch. `;
    }

    summary += `Strongest area: ${strongest.label.toLowerCase()}. `;

    if (weakest.score < 50) {
      summary += `Weakest area: ${weakest.label.toLowerCase()} — ${weakest.summary}`;
    } else if (f.dividendYieldPercent >= 2) {
      summary += `Offers ${f.dividendYieldPercent.toFixed(2)}% dividend yield for income investors.`;
    } else {
      summary += `Better evaluated for ${profile.sector === 'Technology' ? 'growth' : 'total return'} than pure income.`;
    }

    return summary;
  }

  private scoreDividendSafety(f: StockFundamentals, profile: StockProfile): number {
    if (profile.type === 'ETF') return 72;
    if (f.annualDividendPerShare === 0) return 30;

    let score = 55;
    if (f.payoutRatioPercent != null) {
      if (f.payoutRatioPercent <= 60) score += 25;
      else if (f.payoutRatioPercent <= 80) score += 12;
      else if (f.payoutRatioPercent > 100) score -= 25;
      else score -= 10;
    }
    if (f.dividendGrowthPercent != null && f.dividendGrowthPercent > 3) score += 10;
    if (f.dividendYieldPercent >= 2 && f.dividendYieldPercent <= 6) score += 8;
    return Math.max(0, Math.min(100, score));
  }

  private scoreFinancialStrength(f: StockFundamentals): number {
    let score = 55;
    if (f.debtToEquity != null) {
      if (f.debtToEquity < 0.5) score += 25;
      else if (f.debtToEquity < 1) score += 15;
      else if (f.debtToEquity > 2) score -= 20;
      else score -= 5;
    }
    if (f.currentRatio != null) {
      if (f.currentRatio >= 1.5) score += 15;
      else if (f.currentRatio >= 1) score += 5;
      else score -= 15;
    }
    return Math.max(0, Math.min(100, score));
  }

  private scoreProfitability(f: StockFundamentals): number {
    let score = 50;
    if (f.profitMarginPercent != null) {
      if (f.profitMarginPercent >= 20) score += 30;
      else if (f.profitMarginPercent >= 10) score += 18;
      else if (f.profitMarginPercent >= 5) score += 8;
      else score -= 15;
    }
    if (f.returnOnEquityPercent != null) {
      if (f.returnOnEquityPercent >= 15) score += 15;
      else if (f.returnOnEquityPercent >= 8) score += 8;
      else score -= 10;
    }
    if (f.operatingMarginPercent != null && f.operatingMarginPercent >= 15) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  private scoreGrowth(f: StockFundamentals): number {
    let score = 50;
    if (f.revenueGrowthPercent != null) {
      if (f.revenueGrowthPercent >= 10) score += 30;
      else if (f.revenueGrowthPercent >= 3) score += 15;
      else if (f.revenueGrowthPercent >= 0) score += 5;
      else score -= 20;
    }
    if (f.epsGrowthPercent != null) {
      if (f.epsGrowthPercent >= 10) score += 15;
      else if (f.epsGrowthPercent >= 3) score += 8;
      else if (f.epsGrowthPercent < 0) score -= 10;
    }
    return Math.max(0, Math.min(100, score));
  }

  private scoreStability(f: StockFundamentals, profile: StockProfile): number {
    let score = 55;
    if (f.beta != null) {
      if (f.beta < 0.7) score += 25;
      else if (f.beta < 1) score += 15;
      else if (f.beta > 1.3) score -= 15;
    }
    if (profile.marketCapMillions >= 200_000) score += 15;
    else if (profile.marketCapMillions >= 10_000) score += 8;
    else score -= 5;
    if (profile.type === 'ETF') score += 10;
    return Math.max(0, Math.min(100, score));
  }

  private scoreToStatus(score: number): HealthStatus {
    if (score >= 70) return 'good';
    if (score >= 45) return 'fair';
    return 'poor';
  }

  private healthLabel(score: number): string {
    if (score >= 80) return 'Excellent Health';
    if (score >= 65) return 'Good Health';
    if (score >= 45) return 'Fair Health';
    if (score >= 30) return 'Weak Health';
    return 'Poor Health';
  }

  private pillarSummary(id: string, score: number, f: StockFundamentals): string {
    const status = this.scoreToStatus(score);
    const map: Record<string, Record<HealthStatus, string>> = {
      dividend: {
        good: f.dividendGrowthPercent
          ? `Reliable payouts with ${f.dividendGrowthPercent.toFixed(1)}% 5Y dividend growth`
          : 'Dividend appears well-covered by earnings',
        fair: 'Dividend exists but payout or growth needs monitoring',
        poor: 'Dividend safety is a concern — high payout or no dividend',
        unknown: 'Insufficient dividend data',
      },
      financial: {
        good: 'Low debt and strong liquidity position',
        fair: 'Balance sheet is acceptable but not standout',
        poor: 'Elevated debt or tight liquidity raises risk',
        unknown: 'Limited financial data',
      },
      profitability: {
        good: `Healthy margins${f.returnOnEquityPercent ? ` and ${f.returnOnEquityPercent.toFixed(0)}% ROE` : ''}`,
        fair: 'Profitability is average for its sector',
        poor: 'Thin margins or weak returns on capital',
        unknown: 'Profitability data unavailable',
      },
      growth: {
        good: 'Revenue and earnings trending upward',
        fair: 'Modest growth — stable but not expanding fast',
        poor: 'Shrinking revenue or earnings headwinds',
        unknown: 'Growth data unavailable',
      },
      stability: {
        good: 'Low volatility and large, established company',
        fair: 'Moderate stability — typical market sensitivity',
        poor: 'High volatility or small-cap risk profile',
        unknown: 'Stability data unavailable',
      },
    };
    return map[id]?.[status] ?? '';
  }

  private computeIncomeFitScore(
    profile: StockProfile,
    f: StockFundamentals,
    techniques: AnalysisTechnique[],
  ): number {
    let score = 50;

    if (f.dividendYieldPercent >= 2) score += Math.min(f.dividendYieldPercent * 4, 20);
    else if (f.dividendYieldPercent > 0) score += f.dividendYieldPercent * 3;
    else score -= 15;

    if (f.payoutRatioPercent != null) {
      if (f.payoutRatioPercent > 100) score -= 20;
      else if (f.payoutRatioPercent > 75) score -= 8;
      else if (f.payoutRatioPercent >= 30 && f.payoutRatioPercent <= 70) score += 10;
    }

    if (f.beta != null && f.beta < 1) score += 8;
    if (f.beta != null && f.beta > 1.4) score -= 8;

    const bullish = techniques.filter((t) => t.rating === 'bullish').length;
    const caution = techniques.filter((t) => t.rating === 'caution' || t.rating === 'bearish').length;
    score += bullish * 5;
    score -= caution * 6;

    if (profile.type === 'ETF') score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private incomeFitLabel(score: number): string {
    if (score >= 80) return 'Excellent income fit';
    if (score >= 65) return 'Good income fit';
    if (score >= 45) return 'Moderate income fit';
    if (score >= 30) return 'Limited income fit';
    return 'Poor income fit';
  }

  private buildSuggestions(
    profile: StockProfile,
    f: StockFundamentals,
    techniques: AnalysisTechnique[],
    incomeFitScore: number,
    companyHealth: CompanyHealth,
    portfolioTickers: string[],
  ): AnalysisSuggestion[] {
    const suggestions: AnalysisSuggestion[] = [];

    if (companyHealth.overallScore >= 70 && incomeFitScore >= 60) {
      suggestions.push({
        id: 'healthy-income',
        title: 'Healthy company with income potential',
        message: `${profile.symbol} scores ${companyHealth.overallScore}/100 on company health and ${incomeFitScore}/100 on income fit — a well-rounded candidate worth deeper review.`,
        severity: 'positive',
      });
    } else if (companyHealth.overallScore < 45) {
      suggestions.push({
        id: 'health-concern',
        title: 'Company health needs attention',
        message: companyHealth.plainSummary.split('. ')[1] ?? 'Several health checks flagged concerns. Review the Company Health section before investing.',
        severity: 'warning',
      });
    }

    if (incomeFitScore >= 70) {
      suggestions.push({
        id: 'income-fit-high',
        title: 'Strong dividend candidate',
        message: `${profile.symbol} scores ${incomeFitScore}/100 for income-focused portfolios. Consider adding to watchlist and setting a target buy price below current levels.`,
        severity: 'positive',
        action: 'Add to watchlist',
      });
    } else if (incomeFitScore < 35 && f.dividendYieldPercent < 1) {
      suggestions.push({
        id: 'income-fit-low',
        title: 'Better suited for growth',
        message: `${profile.symbol} is not ideal as a primary income holding. If you already hold growth names, pair with dividend ETFs (SCHD, VYM) or stalwarts (JNJ, KO) for paycheck-style income.`,
        severity: 'neutral',
      });
    }

    const highYield = techniques.find((t) => t.id === 'dividend-yield' && t.rating === 'caution');
    if (highYield) {
      suggestions.push({
        id: 'dividend-trap',
        title: 'Verify high yield sustainability',
        message:
          'Unusually high yield may reflect a price drop rather than generous payouts. Review payout ratio, debt levels, and whether the dividend was cut in the past 5 years.',
        severity: 'warning',
      });
    }

    const momentum = techniques.find((t) => t.id === 'momentum');
    if (momentum?.rating === 'bullish') {
      suggestions.push({
        id: 'entry-zone',
        title: 'Potential accumulation zone',
        message:
          'Price sits in the lower half of its 52-week range. Dollar-cost averaging over 2–3 months can reduce timing risk while building a position.',
        severity: 'positive',
        action: 'Consider staged buying',
      });
    } else if (momentum?.rating === 'caution') {
      suggestions.push({
        id: 'wait-pullback',
        title: 'Wait for a better entry',
        message:
          'Trading near 52-week highs. Income investors often benefit from patience — set a price alert 5–10% below current levels before committing capital.',
        severity: 'warning',
        action: 'Set price alert',
      });
    }

    const payout = techniques.find((t) => t.id === 'payout-ratio' && t.rating === 'caution');
    if (payout) {
      suggestions.push({
        id: 'payout-risk',
        title: 'Monitor dividend safety',
        message:
          'Elevated payout ratio increases cut risk during earnings downturns. Track quarterly earnings reports and dividend announcement dates.',
        severity: 'warning',
      });
    }

    const sector = profile.sector;
    const sectorPeers = portfolioTickers.filter((t) => getSectorForTicker(t) === sector);
    if (sectorPeers.length >= 2 && !portfolioTickers.includes(profile.symbol)) {
      suggestions.push({
        id: 'sector-overlap',
        title: 'Sector concentration check',
        message: `You already hold ${sectorPeers.length} positions in ${sector} (${sectorPeers.join(', ')}). Adding ${profile.symbol} increases sector concentration — ensure total ${sector} weight stays within your target allocation.`,
        severity: 'neutral',
      });
    } else if (!portfolioTickers.includes(profile.symbol) && sectorPeers.length === 0 && portfolioTickers.length > 0) {
      suggestions.push({
        id: 'sector-fill',
        title: 'Fills a sector gap',
        message: `${profile.symbol} would add ${sector} exposure your portfolio currently lacks — helpful for diversification if allocation to this sector is below target.`,
        severity: 'positive',
      });
    }

    if (f.dividendYieldPercent >= 2.5 && f.payoutRatioPercent != null && f.payoutRatioPercent < 80) {
      suggestions.push({
        id: 'paycheck-potential',
        title: 'Paycheck portfolio potential',
        message: `At ${f.dividendYieldPercent.toFixed(2)}% yield with a manageable payout ratio, every $10,000 invested generates roughly $${((10000 * f.dividendYieldPercent) / 100 / 12).toFixed(0)}/month in dividends.`,
        severity: 'positive',
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        id: 'general-research',
        title: 'Continue your research',
        message:
          'Review the analysis techniques above, compare with similar tickers, and add to your watchlist to track price before making a decision.',
        severity: 'neutral',
        action: 'Add to watchlist',
      });
    }

    return suggestions.slice(0, 6);
  }

  private similarTickers(symbol: string, sector: string): string[] {
    const fromSector = (SIMILAR_BY_SECTOR[sector] ?? POPULAR_STOCKS.map((s) => s.symbol))
      .filter((t) => t !== symbol)
      .slice(0, 4);

    return fromSector;
  }
}
