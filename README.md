# StockCal

StockCal is a client-side dividend portfolio tracker built with Angular 19. Track holdings, project dividend income, monitor portfolio growth, and explore allocation insights — all stored locally in your browser.

## Features

- **Home** — Portfolio overview with allocation chart, top holdings, income goal progress, and quick-add for new positions
- **Wealth** — Portfolio value history with snapshot tracking over time
- **Paycheck** — Projected monthly dividend income, payment schedules, and progress toward a monthly income goal
- **Insights** — Sector allocation, portfolio health metrics, and a price watchlist
- **Holdings** — Add, edit, refresh, and remove stock positions with ticker autocomplete and stock icons
- **Settings** — Monthly income goal, light/dark/system theme, and JSON backup export/import

All portfolio data is persisted in **IndexedDB** — no account or server required.

## Tech Stack

- [Angular 19](https://angular.dev) (standalone components, lazy-loaded routes)
- [Chart.js](https://www.chartjs.org/) for portfolio and income charts
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via [idb](https://github.com/jakearchibald/idb) for local storage
- [Finnhub](https://finnhub.io/) API for live quotes and dividend data (optional)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200). The app reloads automatically when source files change.

### Live Stock Data (Optional)

Without an API key, StockCal uses built-in mock quotes for popular tickers. For live prices and dividend schedules, add a [Finnhub API key](https://finnhub.io/register) to the environment file:

```typescript
// src/environments/environment.development.ts
export const environment = {
  production: false,
  finnhubApiKey: 'your-api-key-here',
};
```

For production builds, set the key in `src/environments/environment.ts`.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start dev server at `http://localhost:4200` |
| `npm run build` | Production build to `dist/stock-cal` |
| `npm run watch` | Development build with file watching |
| `npm test` | Run unit tests (Karma + Jasmine) |
| `npm run serve:ssr:stock-cal` | Serve the SSR build |

## Project Structure

```
src/app/
├── core/
│   ├── constants/     # Popular stocks, sector mappings
│   ├── models/        # Holdings, metrics, settings, watchlist
│   ├── services/      # Portfolio facade, DB, calculator, stock API
│   └── utils/         # Stock logo helpers
├── features/
│   ├── home/          # Dashboard overview
│   ├── wealth/        # Portfolio value history
│   ├── paycheck/      # Dividend income tracking
│   ├── insights/      # Sector allocation & watchlist
│   ├── holdings/      # Holdings management
│   └── settings/      # Preferences & data backup
└── shared/
    └── components/    # Charts, dialogs, autocomplete, etc.
```

## Data & Privacy

Portfolio data never leaves your browser unless you explicitly export a backup from Settings. Backups are JSON files that can be re-imported on any device running StockCal.

## License

Private project.
