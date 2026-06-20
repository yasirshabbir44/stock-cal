import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home-dashboard.component').then((m) => m.HomeDashboardComponent),
  },
  {
    path: 'wealth',
    loadComponent: () =>
      import('./features/wealth/wealth-dashboard.component').then((m) => m.WealthDashboardComponent),
  },
  {
    path: 'paycheck',
    loadComponent: () =>
      import('./features/paycheck/paycheck-dashboard.component').then((m) => m.PaycheckDashboardComponent),
  },
  {
    path: 'plan',
    loadComponent: () =>
      import('./features/plan/plan-dashboard.component').then((m) => m.PlanDashboardComponent),
  },
  {
    path: 'insights',
    loadComponent: () =>
      import('./features/insights/insights-dashboard.component').then((m) => m.InsightsDashboardComponent),
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
