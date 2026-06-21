import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { POPULAR_STOCKS } from '../constants/popular-stocks';
import { getSectorForTicker } from '../constants/stock-sectors';
import { DividendSchedule } from '../models/dividend-schedule.model';
import { StockProfile, StockFundamentals } from '../models/stock-analysis.model';
import { StockSuggestion } from '../models/stock-search.model';
import { getStockLogoUrl } from '../utils/stock-logo.util';

export interface StockQuote {
  currentPrice: number;
  annualDividendPerShare: number;
}

export interface StockQuoteDetail extends StockQuote {
  changeAmount: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
}

interface FinnhubQuoteResponse {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
}

interface FinnhubProfileResponse {
  name: string;
  ticker: string;
  finnhubIndustry: string;
  country: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  shareOutstanding: number;
  weburl: string;
  logo: string;
}

interface FinnhubMetricResponse {
  metric: {
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
    beta?: number;
    peAnnual?: number;
    epsAnnual?: number;
    payoutRatioAnnual?: number;
    dividendYieldIndicatedAnnual?: number;
    revenueGrowth3Y?: number;
    netProfitMarginAnnual?: number;
    operatingMarginAnnual?: number;
    grossMarginAnnual?: number;
    epsGrowth3Y?: number;
    dividendGrowthRate5Y?: number;
    'totalDebt/totalEquityAnnual'?: number;
    currentRatioAnnual?: number;
    roeRfy?: number;
    pbAnnual?: number;
    psAnnual?: number;
  };
}

interface FinnhubDividendEntry {
  exDate: string;
  payDate: string;
  amount: number;
}

interface FinnhubSearchResponse {
  result: Array<{
    symbol: string;
    description: string;
    type: string;
  }>;
}

const MOCK_QUOTES: Record<string, StockQuoteDetail> = {
  AAPL: {
    currentPrice: 195.5,
    annualDividendPerShare: 0.96,
    changeAmount: 1.2,
    changePercent: 0.62,
    dayHigh: 197.1,
    dayLow: 193.8,
    previousClose: 194.3,
  },
  MSFT: {
    currentPrice: 420.25,
    annualDividendPerShare: 3.0,
    changeAmount: -2.15,
    changePercent: -0.51,
    dayHigh: 424.0,
    dayLow: 418.5,
    previousClose: 422.4,
  },
  JNJ: {
    currentPrice: 155.8,
    annualDividendPerShare: 4.76,
    changeAmount: 0.45,
    changePercent: 0.29,
    dayHigh: 156.5,
    dayLow: 154.9,
    previousClose: 155.35,
  },
  KO: {
    currentPrice: 62.4,
    annualDividendPerShare: 1.94,
    changeAmount: 0.12,
    changePercent: 0.19,
    dayHigh: 62.8,
    dayLow: 61.9,
    previousClose: 62.28,
  },
  O: {
    currentPrice: 58.3,
    annualDividendPerShare: 3.07,
    changeAmount: -0.25,
    changePercent: -0.43,
    dayHigh: 58.9,
    dayLow: 57.8,
    previousClose: 58.55,
  },
  SCHD: {
    currentPrice: 27.5,
    annualDividendPerShare: 0.82,
    changeAmount: 0.08,
    changePercent: 0.29,
    dayHigh: 27.65,
    dayLow: 27.2,
    previousClose: 27.42,
  },
  VYM: {
    currentPrice: 118.2,
    annualDividendPerShare: 3.45,
    changeAmount: 0.35,
    changePercent: 0.3,
    dayHigh: 118.9,
    dayLow: 117.4,
    previousClose: 117.85,
  },
};

interface MockProfileEntry {
  name: string;
  type: string;
  industry: string;
  marketCapMillions: number;
  sharesOutstanding: number;
  peRatio: number;
  eps: number;
  payoutRatioPercent: number;
  beta: number;
  week52High: number;
  week52Low: number;
  revenueGrowthPercent: number;
  profitMarginPercent: number;
  operatingMarginPercent: number;
  grossMarginPercent: number;
  epsGrowthPercent: number;
  dividendGrowthPercent: number;
  debtToEquity: number;
  currentRatio: number;
  returnOnEquityPercent: number;
  priceToBook: number;
  priceToSales: number;
  website?: string;
}

const MOCK_PROFILES: Record<string, MockProfileEntry> = {
  AAPL: {
    name: 'Apple Inc',
    type: 'Common Stock',
    industry: 'Technology Hardware',
    marketCapMillions: 3_020_000,
    sharesOutstanding: 15_400,
    peRatio: 31.2,
    eps: 6.26,
    payoutRatioPercent: 15,
    beta: 1.24,
    week52High: 220.5,
    week52Low: 164.0,
    revenueGrowthPercent: 4.8,
    profitMarginPercent: 26.3,
    operatingMarginPercent: 30.1,
    grossMarginPercent: 45.9,
    epsGrowthPercent: 8.5,
    dividendGrowthPercent: 4.2,
    debtToEquity: 1.52,
    currentRatio: 0.98,
    returnOnEquityPercent: 147.0,
    priceToBook: 45.2,
    priceToSales: 7.8,
    website: 'https://www.apple.com',
  },
  MSFT: {
    name: 'Microsoft Corporation',
    type: 'Common Stock',
    industry: 'Software',
    marketCapMillions: 3_120_000,
    sharesOutstanding: 7_430,
    peRatio: 35.8,
    eps: 11.74,
    payoutRatioPercent: 25,
    beta: 0.89,
    week52High: 450.0,
    week52Low: 362.0,
    revenueGrowthPercent: 15.2,
    profitMarginPercent: 35.6,
    operatingMarginPercent: 42.0,
    grossMarginPercent: 68.8,
    epsGrowthPercent: 12.4,
    dividendGrowthPercent: 10.1,
    debtToEquity: 0.35,
    currentRatio: 1.66,
    returnOnEquityPercent: 38.5,
    priceToBook: 12.4,
    priceToSales: 12.1,
    website: 'https://www.microsoft.com',
  },
  JNJ: {
    name: 'Johnson & Johnson',
    type: 'Common Stock',
    industry: 'Drug Manufacturers',
    marketCapMillions: 375_000,
    sharesOutstanding: 2_410,
    peRatio: 24.5,
    eps: 6.36,
    payoutRatioPercent: 48,
    beta: 0.52,
    week52High: 168.0,
    week52Low: 143.0,
    revenueGrowthPercent: 5.1,
    profitMarginPercent: 18.2,
    operatingMarginPercent: 24.5,
    grossMarginPercent: 68.0,
    epsGrowthPercent: 6.2,
    dividendGrowthPercent: 5.8,
    debtToEquity: 0.58,
    currentRatio: 1.12,
    returnOnEquityPercent: 22.4,
    priceToBook: 5.8,
    priceToSales: 4.2,
    website: 'https://www.jnj.com',
  },
  KO: {
    name: 'The Coca-Cola Company',
    type: 'Common Stock',
    industry: 'Beverages',
    marketCapMillions: 268_000,
    sharesOutstanding: 4_310,
    peRatio: 24.8,
    eps: 2.52,
    payoutRatioPercent: 77,
    beta: 0.58,
    week52High: 65.5,
    week52Low: 56.0,
    revenueGrowthPercent: 3.2,
    profitMarginPercent: 22.8,
    operatingMarginPercent: 28.5,
    grossMarginPercent: 59.2,
    epsGrowthPercent: 2.8,
    dividendGrowthPercent: 3.5,
    debtToEquity: 1.85,
    currentRatio: 1.05,
    returnOnEquityPercent: 42.1,
    priceToBook: 10.2,
    priceToSales: 6.1,
    website: 'https://www.coca-colacompany.com',
  },
  O: {
    name: 'Realty Income Corporation',
    type: 'REIT',
    industry: 'REIT Retail',
    marketCapMillions: 48_000,
    sharesOutstanding: 820,
    peRatio: 54.2,
    eps: 1.08,
    payoutRatioPercent: 285,
    beta: 0.72,
    week52High: 62.0,
    week52Low: 48.5,
    revenueGrowthPercent: 8.4,
    profitMarginPercent: 18.5,
    operatingMarginPercent: 42.0,
    grossMarginPercent: 95.0,
    epsGrowthPercent: 4.5,
    dividendGrowthPercent: 4.1,
    debtToEquity: 0.72,
    currentRatio: 1.8,
    returnOnEquityPercent: 2.8,
    priceToBook: 1.4,
    priceToSales: 10.5,
    website: 'https://www.realtyincome.com',
  },
  SCHD: {
    name: 'Schwab US Dividend Equity ETF',
    type: 'ETF',
    industry: 'Large Blend',
    marketCapMillions: 58_000,
    sharesOutstanding: 2_100,
    peRatio: 16.4,
    eps: 1.68,
    payoutRatioPercent: 49,
    beta: 0.82,
    week52High: 29.2,
    week52Low: 24.8,
    revenueGrowthPercent: 6.5,
    profitMarginPercent: 12.0,
    operatingMarginPercent: 14.0,
    grossMarginPercent: 28.0,
    epsGrowthPercent: 7.0,
    dividendGrowthPercent: 9.5,
    debtToEquity: 0.45,
    currentRatio: 1.4,
    returnOnEquityPercent: 18.0,
    priceToBook: 2.6,
    priceToSales: 2.1,
    website: 'https://www.schwabassetmanagement.com',
  },
  VYM: {
    name: 'Vanguard High Dividend Yield ETF',
    type: 'ETF',
    industry: 'Large Value',
    marketCapMillions: 72_000,
    sharesOutstanding: 610,
    peRatio: 17.2,
    eps: 6.87,
    payoutRatioPercent: 50,
    beta: 0.88,
    week52High: 122.0,
    week52Low: 104.0,
    revenueGrowthPercent: 5.8,
    profitMarginPercent: 14.2,
    operatingMarginPercent: 16.5,
    grossMarginPercent: 32.0,
    epsGrowthPercent: 5.5,
    dividendGrowthPercent: 7.2,
    debtToEquity: 0.55,
    currentRatio: 1.35,
    returnOnEquityPercent: 16.5,
    priceToBook: 2.8,
    priceToSales: 2.4,
    website: 'https://investor.vanguard.com',
  },
};

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly userApiKey = signal('');

  readonly usingLiveQuotes = computed(() => this.getEffectiveApiKey().length > 0);

  setUserApiKey(key: string): void {
    this.userApiKey.set(key.trim());
  }

  hasLiveData(): boolean {
    return this.usingLiveQuotes();
  }

  private getEffectiveApiKey(): string {
    return this.userApiKey() || environment.finnhubApiKey.trim();
  }

  async fetchQuote(ticker: string): Promise<StockQuote> {
    const detail = await this.fetchQuoteDetail(ticker);
    return {
      currentPrice: detail.currentPrice,
      annualDividendPerShare: detail.annualDividendPerShare,
    };
  }

  async fetchQuoteDetail(ticker: string): Promise<StockQuoteDetail> {
    const symbol = ticker.toUpperCase().trim();
    const apiKey = this.getEffectiveApiKey();

    if (!apiKey) {
      return this.getMockQuoteDetail(symbol);
    }

    try {
      const [quote, dividends] = await Promise.all([
        firstValueFrom(
          this.http.get<FinnhubQuoteResponse>(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
          ),
        ),
        firstValueFrom(
          this.http.get<FinnhubDividendEntry[]>(
            `https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&token=${apiKey}`,
          ),
        ),
      ]);

      const annualDividendPerShare = this.estimateAnnualDividend(dividends);
      const currentPrice = this.resolveCurrentPrice(quote);

      if (currentPrice <= 0) {
        return this.getMockQuoteDetail(symbol);
      }

      return {
        currentPrice,
        annualDividendPerShare,
        changeAmount: quote.d ?? 0,
        changePercent: quote.dp ?? 0,
        dayHigh: quote.h > 0 ? quote.h : currentPrice,
        dayLow: quote.l > 0 ? quote.l : currentPrice,
        previousClose: quote.pc > 0 ? quote.pc : currentPrice,
      };
    } catch {
      return this.getMockQuoteDetail(symbol);
    }
  }

  private resolveCurrentPrice(quote: FinnhubQuoteResponse): number {
    if (quote.c > 0) {
      return quote.c;
    }
    if (quote.pc > 0) {
      return quote.pc;
    }
    return 0;
  }

  async fetchProfile(ticker: string): Promise<StockProfile> {
    const symbol = ticker.toUpperCase().trim();

    const apiKey = this.getEffectiveApiKey();

    if (!apiKey) {
      return this.getMockProfile(symbol);
    }

    try {
      const response = await firstValueFrom(
        this.http.get<FinnhubProfileResponse>(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`,
        ),
      );

      if (!response?.name) {
        return this.getMockProfile(symbol);
      }

      const popular = POPULAR_STOCKS.find((s) => s.symbol === symbol);

      return {
        symbol,
        name: response.name,
        type: popular?.type ?? 'Common Stock',
        sector: getSectorForTicker(symbol),
        industry: response.finnhubIndustry || getSectorForTicker(symbol),
        country: response.country || 'US',
        exchange: response.exchange || 'US',
        ipoDate: response.ipo || undefined,
        marketCapMillions: response.marketCapitalization || 0,
        sharesOutstanding: response.shareOutstanding || 0,
        website: response.weburl || undefined,
        logoUrl: response.logo || getStockLogoUrl(symbol),
      };
    } catch {
      return this.getMockProfile(symbol);
    }
  }

  async fetchFundamentals(ticker: string): Promise<StockFundamentals> {
    const symbol = ticker.toUpperCase().trim();
    const quote = await this.fetchQuoteDetail(symbol);

    const apiKey = this.getEffectiveApiKey();

    if (!apiKey) {
      return this.buildMockFundamentals(symbol, quote);
    }

    try {
      const metrics = await firstValueFrom(
        this.http.get<FinnhubMetricResponse>(
          `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`,
        ),
      );

      const m = metrics?.metric ?? {};
      const yieldFromApi = m.dividendYieldIndicatedAnnual;
      const dividendYieldPercent =
        yieldFromApi != null && yieldFromApi > 0
          ? yieldFromApi
          : quote.currentPrice > 0
            ? (quote.annualDividendPerShare / quote.currentPrice) * 100
            : 0;

      return {
        currentPrice: quote.currentPrice,
        changeAmount: quote.changeAmount,
        changePercent: quote.changePercent,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        previousClose: quote.previousClose,
        annualDividendPerShare: quote.annualDividendPerShare,
        dividendYieldPercent,
        peRatio: m.peAnnual,
        eps: m.epsAnnual,
        payoutRatioPercent: m.payoutRatioAnnual != null ? m.payoutRatioAnnual * 100 : undefined,
        beta: m.beta,
        week52High: m['52WeekHigh'],
        week52Low: m['52WeekLow'],
        revenueGrowthPercent: m.revenueGrowth3Y != null ? m.revenueGrowth3Y * 100 : undefined,
        profitMarginPercent: m.netProfitMarginAnnual != null ? m.netProfitMarginAnnual * 100 : undefined,
        operatingMarginPercent: m.operatingMarginAnnual != null ? m.operatingMarginAnnual * 100 : undefined,
        grossMarginPercent: m.grossMarginAnnual != null ? m.grossMarginAnnual * 100 : undefined,
        epsGrowthPercent: m.epsGrowth3Y != null ? m.epsGrowth3Y * 100 : undefined,
        dividendGrowthPercent: m.dividendGrowthRate5Y != null ? m.dividendGrowthRate5Y * 100 : undefined,
        debtToEquity: m['totalDebt/totalEquityAnnual'],
        currentRatio: m.currentRatioAnnual,
        returnOnEquityPercent: m.roeRfy != null ? m.roeRfy * 100 : undefined,
        priceToBook: m.pbAnnual,
        priceToSales: m.psAnnual,
      };
    } catch {
      return this.buildMockFundamentals(symbol, quote);
    }
  }

  async searchSymbols(query: string): Promise<StockSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      return this.withLogos(POPULAR_STOCKS.slice(0, 8));
    }

    const apiKey = this.getEffectiveApiKey();

    if (!apiKey) {
      return this.searchMockSymbols(trimmed);
    }

    try {
      const response = await firstValueFrom(
        this.http.get<FinnhubSearchResponse>(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(trimmed)}&token=${apiKey}`,
        ),
      );

      const results = (response.result ?? [])
        .filter((item) => item.type === 'Common Stock' || item.type === 'ETF' || item.type === 'REIT')
        .slice(0, 8)
        .map((item) => ({
          symbol: item.symbol.toUpperCase(),
          name: item.description,
          type: item.type,
        }));

      return results.length ? this.withLogos(results) : this.searchMockSymbols(trimmed);
    } catch {
      return this.searchMockSymbols(trimmed);
    }
  }

  async fetchUpcomingDividends(ticker: string): Promise<DividendSchedule[]> {
    const symbol = ticker.toUpperCase().trim();

    const apiKey = this.getEffectiveApiKey();

    if (!apiKey) {
      return this.getMockSchedules(symbol);
    }

    try {
      const dividends = await firstValueFrom(
        this.http.get<FinnhubDividendEntry[]>(
          `https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&token=${apiKey}`,
        ),
      );

      const today = new Date().toISOString().slice(0, 10);
      return dividends
        .filter((d) => d.payDate >= today)
        .slice(0, 4)
        .map((d, index) => ({
          id: `${symbol}-${d.payDate}-${index}`,
          ticker: symbol,
          exDate: d.exDate,
          payDate: d.payDate,
          amountPerShare: d.amount,
        }));
    } catch {
      return this.getMockSchedules(symbol);
    }
  }

  private searchMockSymbols(query: string): StockSuggestion[] {
    const upper = query.toUpperCase();
    const matches = POPULAR_STOCKS.filter(
      (stock) =>
        stock.symbol.includes(upper) ||
        stock.name.toUpperCase().includes(upper) ||
        stock.type.toUpperCase().includes(upper),
    );

    return this.withLogos(matches.slice(0, 8));
  }

  private withLogos(suggestions: StockSuggestion[]): StockSuggestion[] {
    return suggestions.map((suggestion) => ({
      ...suggestion,
      logoUrl: getStockLogoUrl(suggestion.symbol),
    }));
  }

  private estimateAnnualDividend(dividends: FinnhubDividendEntry[]): number {
    if (!dividends.length) {
      return 0;
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoff = oneYearAgo.toISOString().slice(0, 10);

    const recent = dividends.filter((d) => d.exDate >= cutoff);
    return recent.reduce((sum, d) => sum + d.amount, 0);
  }

  private getMockQuoteDetail(symbol: string): StockQuoteDetail {
    if (MOCK_QUOTES[symbol]) {
      return { ...MOCK_QUOTES[symbol] };
    }

    const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const price = +(50 + (hash % 200)).toFixed(2);
    const dividend = +((hash % 400) / 100).toFixed(2);
    return {
      currentPrice: price,
      annualDividendPerShare: dividend,
      changeAmount: +((hash % 20) / 10 - 1).toFixed(2),
      changePercent: +((hash % 20) / 10 - 1).toFixed(2),
      dayHigh: +(price * 1.02).toFixed(2),
      dayLow: +(price * 0.98).toFixed(2),
      previousClose: +(price * 0.995).toFixed(2),
    };
  }

  private getMockProfile(symbol: string): StockProfile {
    const mock = MOCK_PROFILES[symbol];
    const popular = POPULAR_STOCKS.find((s) => s.symbol === symbol);
    const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    return {
      symbol,
      name: mock?.name ?? popular?.name ?? `${symbol} Corporation`,
      type: mock?.type ?? popular?.type ?? 'Common Stock',
      sector: getSectorForTicker(symbol),
      industry: mock?.industry ?? getSectorForTicker(symbol),
      country: 'US',
      exchange: 'US',
      ipoDate: undefined,
      marketCapMillions: mock?.marketCapMillions ?? 10_000 + (hash % 500) * 100,
      sharesOutstanding: mock?.sharesOutstanding ?? 500 + (hash % 2000),
      website: mock?.website,
      logoUrl: getStockLogoUrl(symbol),
    };
  }

  private buildMockFundamentals(symbol: string, quote: StockQuoteDetail): StockFundamentals {
    const mock = MOCK_PROFILES[symbol];
    const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const dividendYieldPercent =
      quote.currentPrice > 0 ? (quote.annualDividendPerShare / quote.currentPrice) * 100 : 0;

    return {
      currentPrice: quote.currentPrice,
      changeAmount: quote.changeAmount,
      changePercent: quote.changePercent,
      dayHigh: quote.dayHigh,
      dayLow: quote.dayLow,
      previousClose: quote.previousClose,
      annualDividendPerShare: quote.annualDividendPerShare,
      dividendYieldPercent,
      peRatio: mock?.peRatio ?? 15 + (hash % 25),
      eps: mock?.eps ?? +(quote.currentPrice / (15 + (hash % 25))).toFixed(2),
      payoutRatioPercent: mock?.payoutRatioPercent ?? Math.min(dividendYieldPercent * 8, 90),
      beta: mock?.beta ?? 0.6 + (hash % 80) / 100,
      week52High: mock?.week52High ?? +(quote.currentPrice * 1.18).toFixed(2),
      week52Low: mock?.week52Low ?? +(quote.currentPrice * 0.82).toFixed(2),
      revenueGrowthPercent: mock?.revenueGrowthPercent ?? (hash % 20) - 2,
      profitMarginPercent: mock?.profitMarginPercent ?? 8 + (hash % 25),
      operatingMarginPercent: mock?.operatingMarginPercent ?? 10 + (hash % 20),
      grossMarginPercent: mock?.grossMarginPercent ?? 25 + (hash % 30),
      epsGrowthPercent: mock?.epsGrowthPercent ?? (hash % 15) - 1,
      dividendGrowthPercent: mock?.dividendGrowthPercent ?? (hash % 10),
      debtToEquity: mock?.debtToEquity ?? 0.3 + (hash % 150) / 100,
      currentRatio: mock?.currentRatio ?? 0.8 + (hash % 120) / 100,
      returnOnEquityPercent: mock?.returnOnEquityPercent ?? 10 + (hash % 30),
      priceToBook: mock?.priceToBook ?? 1.5 + (hash % 80) / 10,
      priceToSales: mock?.priceToSales ?? 1.2 + (hash % 60) / 10,
    };
  }

  private getMockQuote(symbol: string): StockQuote {
    const detail = this.getMockQuoteDetail(symbol);
    return {
      currentPrice: detail.currentPrice,
      annualDividendPerShare: detail.annualDividendPerShare,
    };
  }

  private getMockSchedules(symbol: string): DividendSchedule[] {
    const quote = MOCK_QUOTES[symbol];
    if (!quote || quote.annualDividendPerShare === 0) {
      return [];
    }

    const quarterlyAmount = +(quote.annualDividendPerShare / 4).toFixed(4);
    const schedules: DividendSchedule[] = [];
    const now = new Date();

    for (let i = 1; i <= 4; i++) {
      const payDate = new Date(now.getFullYear(), now.getMonth() + i * 3, 15);
      const exDate = new Date(payDate);
      exDate.setDate(exDate.getDate() - 14);
      const payDateStr = payDate.toISOString().slice(0, 10);

      schedules.push({
        id: `${symbol}-${payDateStr}`,
        ticker: symbol,
        exDate: exDate.toISOString().slice(0, 10),
        payDate: payDateStr,
        amountPerShare: quarterlyAmount,
      });
    }

    return schedules;
  }
}
