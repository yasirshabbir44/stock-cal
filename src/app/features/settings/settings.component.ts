import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly settings = this.portfolio.settings;
  readonly loading = this.portfolio.loading;

  monthlyGoal = 1000;
  saving = signal(false);

  ngOnInit(): void {
    void this.portfolio.init().then(() => {
      this.monthlyGoal = this.settings().monthlyIncomeGoal;
    });
  }

  async saveGoal(): Promise<void> {
    this.saving.set(true);
    try {
      await this.portfolio.updateMonthlyIncomeGoal(this.monthlyGoal);
    } finally {
      this.saving.set(false);
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
    } catch {
      // toast handled in facade
    } finally {
      input.value = '';
    }
  }

  async clearAll(): Promise<void> {
    if (confirm('Delete all holdings and reset your portfolio? This cannot be undone.')) {
      await this.portfolio.clearPortfolio();
    }
  }
}
