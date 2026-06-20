import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { PortfolioFacadeService } from './core/services/portfolio-facade.service';
import { ThemeService } from './core/services/theme.service';
import { ToastComponent } from './shared/components/toast.component';
import { LoadingOverlayComponent } from './shared/components/loading-overlay.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog.component';
import { PageFooterComponent } from './shared/components/page-footer.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
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

  readonly navItems: NavItem[] = [
    { path: '/home', label: 'Home', icon: '⌂', exact: true },
    { path: '/wealth', label: 'Wealth', icon: '◆' },
    { path: '/paycheck', label: 'Paycheck', icon: '$' },
    { path: '/holdings', label: 'Holdings', icon: '☰' },
    { path: '/settings', label: 'Settings', icon: '⚙' },
  ];

  ngOnInit(): void {
    void this.portfolio.init();
  }

  toggleTheme(): void {
    this.theme.toggle();
  }
}
