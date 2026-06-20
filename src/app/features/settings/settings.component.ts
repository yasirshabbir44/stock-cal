import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit, OnDestroy {
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly confirm = inject(ConfirmDialogService);
  readonly theme = inject(ThemeService);

  readonly settings = this.portfolio.settings;
  readonly loading = this.portfolio.loading;

  monthlyGoal = 1000;
  saving = signal(false);
  saved = signal(true);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.portfolio.init().then(() => {
      this.monthlyGoal = this.settings().monthlyIncomeGoal;
    });
  }

  ngOnDestroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
  }

  onGoalChange(): void {
    this.saved.set(false);

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      void this.saveGoal();
    }, 800);
  }

  async saveGoal(): Promise<void> {
    this.saving.set(true);
    try {
      await this.portfolio.updateMonthlyIncomeGoal(this.monthlyGoal, false);
      this.saved.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  setTheme(mode: 'dark' | 'light' | 'system'): void {
    if (mode === 'system') {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      this.theme.setTheme(prefersLight ? 'light' : 'dark');
    } else {
      this.theme.setTheme(mode);
    }
  }

  async exportBackup(): Promise<void> {
    const data = await this.portfolio.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stockcal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await this.portfolio.importData(data);
      this.monthlyGoal = this.settings().monthlyIncomeGoal;
    } catch {
      // toast handled in facade
    } finally {
      input.value = '';
    }
  }

  async clearAll(): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Clear all data',
      message: 'Delete all holdings and reset your portfolio? This cannot be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
    });

    if (confirmed) {
      await this.portfolio.clearPortfolio();
      this.monthlyGoal = this.settings().monthlyIncomeGoal;
    }
  }
}
