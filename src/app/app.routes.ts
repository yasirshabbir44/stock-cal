import { Routes } from '@angular/router';
import { StockAnalysisService } from './core/services/stock-analysis.service';
import { loadRouteWithProjectionLib } from './core/calculations/route-loaders';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    loadComponent: loadRouteWithProjectionLib(() =>
      import('./features/home/home-dashboard.component').then((m) => m.HomeDashboardComponent),
    ),
  },
  {
    path: 'wealth',
    loadComponent: loadRouteWithProjectionLib(() =>
      import('./features/wealth/wealth-dashboard.component').then((m) => m.WealthDashboardComponent),
    ),
  },
  {
    path: 'paycheck',
    loadComponent: loadRouteWithProjectionLib(
      () =>
        import('./features/paycheck/paycheck-dashboard.component').then((m) => m.PaycheckDashboardComponent),
      { waitForLib: true },
    ),
  },
  {
    path: 'plan',
    loadComponent: loadRouteWithProjectionLib(
      () => import('./features/plan/plan-dashboard.component').then((m) => m.PlanDashboardComponent),
      { waitForLib: true },
    ),
  },
  {
    path: 'insights',
    loadComponent: loadRouteWithProjectionLib(() =>
      import('./features/insights/insights-dashboard.component').then((m) => m.InsightsDashboardComponent),
    ),
  },
  {
    path: 'research',
    loadComponent: () =>
      import('./features/research/stock-research.component').then((m) => m.StockResearchComponent),
    providers: [StockAnalysisService],
  },
  {
    path: 'research/:symbol',
    loadComponent: () =>
      import('./features/research/stock-research.component').then((m) => m.StockResearchComponent),
    providers: [StockAnalysisService],
  },
  {
    path: 'holdings',
    loadComponent: () => import('./features/holdings/holdings.component').then((m) => m.HoldingsComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
