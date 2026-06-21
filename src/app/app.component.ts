import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { PortfolioFacadeService } from './core/services/portfolio-facade.service';
import { ThemeService } from './core/services/theme.service';
import { ToastComponent } from './shared/components/toast.component';
import { LoadingOverlayComponent } from './shared/components/loading-overlay.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog.component';
import { PageFooterComponent } from './shared/components/page-footer.component';

type NavIcon =
  | 'home'
  | 'wealth'
  | 'paycheck'
  | 'plan'
  | 'insights'
  | 'research'
  | 'holdings'
  | 'settings';

interface NavItem {
  path: string;
  label: string;
  icon: NavIcon;
  exact?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CurrencyPipe,
    ToastComponent,
    LoadingOverlayComponent,
    ConfirmDialogComponent,
    PageFooterComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);
  readonly theme = inject(ThemeService);

  readonly metrics = this.portfolio.metrics;
  readonly loading = this.portfolio.loading;
  readonly hasActiveSimulations = this.portfolio.hasActiveSimulations;

  readonly navItems: NavItem[] = [
    { path: '/home', label: 'Home', icon: 'home', exact: true },
    { path: '/wealth', label: 'Wealth', icon: 'wealth' },
    { path: '/paycheck', label: 'Paycheck', icon: 'paycheck' },
    { path: '/plan', label: 'Plan', icon: 'plan' },
    { path: '/insights', label: 'Insights', icon: 'insights' },
    { path: '/research', label: 'Research', icon: 'research' },
    { path: '/holdings', label: 'Holdings', icon: 'holdings' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  ngOnInit(): void {
    void this.portfolio.init();
  }

  toggleTheme(): void {
    this.theme.toggle();
  }
}
