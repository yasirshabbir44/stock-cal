import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DividendSchedule } from '../models/dividend-schedule.model';

export interface StockQuote {
  currentPrice: number;
  annualDividendPerShare: number;
}

interface FinnhubQuoteResponse {
  c: number;
}

interface FinnhubDividendEntry {
  exDate: string;
  payDate: string;
  amount: number;
}

const MOCK_QUOTES: Record<string, StockQuote> = {
  AAPL: { currentPrice: 195.5, annualDividendPerShare: 0.96 },
  MSFT: { currentPrice: 420.25, annualDividendPerShare: 3.0 },
  JNJ: { currentPrice: 155.8, annualDividendPerShare: 4.76 },
  KO: { currentPrice: 62.4, annualDividendPerShare: 1.94 },
  O: { currentPrice: 58.3, annualDividendPerShare: 3.07 },
  SCHD: { currentPrice: 27.5, annualDividendPerShare: 0.82 },
  VYM: { currentPrice: 118.2, annualDividendPerShare: 3.45 },
};

@Injectable({ providedIn: 'root' })
export class StockApiService {
  private readonly http = inject(HttpClient);
  private readonly apiKey = environment.finnhubApiKey;

  async fetchQuote(ticker: string): Promise<StockQuote> {
    const symbol = ticker.toUpperCase().trim();

    if (!this.apiKey) {
      return this.getMockQuote(symbol);
    }

    try {
      const [quote, dividends] = await Promise.all([
        firstValueFrom(
          this.http.get<FinnhubQuoteResponse>(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.apiKey}`,
          ),
        ),
        firstValueFrom(
          this.http.get<FinnhubDividendEntry[]>(
            `https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&token=${this.apiKey}`,
          ),
        ),
      ]);

      const annualDividendPerShare = this.estimateAnnualDividend(dividends);

      return {
        currentPrice: quote.c > 0 ? quote.c : this.getMockQuote(symbol).currentPrice,
        annualDividendPerShare,
      };
    } catch {
      return this.getMockQuote(symbol);
    }
  }

  async fetchUpcomingDividends(ticker: string): Promise<DividendSchedule[]> {
    const symbol = ticker.toUpperCase().trim();

    if (!this.apiKey) {
      return this.getMockSchedules(symbol);
    }

    try {
      const dividends = await firstValueFrom(
        this.http.get<FinnhubDividendEntry[]>(
          `https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&token=${this.apiKey}`,
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

  private getMockQuote(symbol: string): StockQuote {
    if (MOCK_QUOTES[symbol]) {
      const jitter = 1 + (Math.random() * 0.02 - 0.01);
      return {
        currentPrice: +(MOCK_QUOTES[symbol].currentPrice * jitter).toFixed(2),
        annualDividendPerShare: MOCK_QUOTES[symbol].annualDividendPerShare,
      };
    }

    const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return {
      currentPrice: +(50 + (hash % 200) + Math.random()).toFixed(2),
      annualDividendPerShare: +((hash % 400) / 100).toFixed(2),
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
