import { DividendSchedule } from '../models/dividend-schedule.model';

export type DividendFrequency = 'monthly' | 'quarterly';

/** Tickers widely known to pay monthly dividends (REITs, BDCs, etc.). */
export const KNOWN_MONTHLY_DIVIDEND_TICKERS = new Set([
  'O',
  'MAIN',
  'STAG',
  'AGNC',
  'ORC',
  'NLY',
  'STWD',
  'LTC',
  'GOOD',
  'PSEC',
  'EPR',
  'LAND',
  'ADC',
  'NNN',
  'WPC',
  'GLAD',
  'GAIN',
  'SLRC',
  'HTGC',
  'ARCC',
]);

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function inferDividendFrequency(
  ticker: string,
  schedules: DividendSchedule[],
): DividendFrequency {
  const symbol = ticker.toUpperCase();

  if (KNOWN_MONTHLY_DIVIDEND_TICKERS.has(symbol)) {
    return 'monthly';
  }

  const tickerSchedules = schedules
    .filter((s) => s.ticker === symbol)
    .sort((a, b) => a.payDate.localeCompare(b.payDate));

  if (tickerSchedules.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < tickerSchedules.length; i++) {
      gaps.push(daysBetween(tickerSchedules[i - 1].payDate, tickerSchedules[i].payDate));
    }
    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    return avgGap <= 45 ? 'monthly' : 'quarterly';
  }

  return 'quarterly';
}
