import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { PortfolioFacadeService } from './core/services/portfolio-facade.service';
import { ToastComponent } from './shared/components/toast.component';
import { LoadingOverlayComponent } from './shared/components/loading-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CurrencyPipe, ToastComponent, LoadingOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly metrics = this.portfolio.metrics;
  readonly loading = this.portfolio.loading;

  ngOnInit(): void {
    void this.portfolio.init();
  }
}
