import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GITHUB_REPO_URL } from '../../core/constants/app-links';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ThemeService } from '../../core/services/theme.service';
import { SaveFeedbackService } from '../../core/services/save-feedback.service';
import { ToastService } from '../../core/services/toast.service';
import { sha256Hex } from '../../core/utils/file-hash.util';
import { downloadHoldingsCsv, downloadPortfolioBackup } from '../../core/utils/portfolio-export.util';

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
  readonly feedback = inject(SaveFeedbackService);
  private readonly toast = inject(ToastService);
  readonly theme = inject(ThemeService);
  readonly githubRepoUrl = GITHUB_REPO_URL;

  readonly settings = this.portfolio.settings;
  readonly loading = this.portfolio.loading;

  monthlyGoal = 1000;
  finnhubApiKey = '';
  saving = signal(false);
  apiKeySaving = signal(false);
  saved = signal(true);
  apiKeySaved = signal(true);
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private apiKeySaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly usingLiveQuotes = this.portfolio.usingLiveQuotes;

  backupHash = signal<string | null>(null);
  backupHashLabel = signal('');
  verifying = signal(false);

  ngOnInit(): void {
    void this.portfolio.init().then(() => {
      this.monthlyGoal = this.settings().monthlyIncomeGoal;
      this.finnhubApiKey = this.settings().finnhubApiKey ?? '';
    });
  }

  ngOnDestroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    if (this.apiKeySaveTimer) {
      clearTimeout(this.apiKeySaveTimer);
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
      this.feedback.persisted('settings-goal', 'Saved to local storage', false);
    } finally {
      this.saving.set(false);
    }
  }

  onApiKeyChange(): void {
    this.apiKeySaved.set(false);

    if (this.apiKeySaveTimer) {
      clearTimeout(this.apiKeySaveTimer);
    }

    this.apiKeySaveTimer = setTimeout(() => {
      void this.saveApiKey();
    }, 800);
  }

  async saveApiKey(): Promise<void> {
    this.apiKeySaving.set(true);
    try {
      await this.portfolio.updateFinnhubApiKey(this.finnhubApiKey, false);
      this.apiKeySaved.set(true);
      this.feedback.persisted('settings-api-key', 'Saved to local storage', false);
    } finally {
      this.apiKeySaving.set(false);
    }
  }

  setTheme(mode: 'dark' | 'light' | 'system'): void {
    this.theme.setPreference(mode);
  }

  async exportBackup(): Promise<void> {
    const hash = await downloadPortfolioBackup(this.portfolio, this.toast);
    this.backupHash.set(hash);
    this.backupHashLabel.set(`stockcal-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async onVerifyFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.verifying.set(true);
    try {
      const text = await file.text();
      JSON.parse(text);
      const hash = await sha256Hex(text);
      this.backupHash.set(hash);
      this.backupHashLabel.set(file.name);
      this.toast.success('SHA-256 fingerprint generated — compare with your saved hash');
    } catch (err) {
      if (err instanceof SyntaxError) {
        this.toast.error('Invalid JSON file — could not verify backup');
      } else {
        this.toast.error('Could not generate fingerprint');
      }
    } finally {
      this.verifying.set(false);
      input.value = '';
    }
  }

  async copyHash(): Promise<void> {
    const hash = this.backupHash();
    if (!hash) {
      return;
    }

    try {
      await navigator.clipboard.writeText(hash);
      this.toast.success('SHA-256 copied to clipboard');
    } catch {
      this.toast.error('Could not copy to clipboard');
    }
  }

  exportCsv(): void {
    downloadHoldingsCsv(this.portfolio);
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
    } catch (err) {
      if (err instanceof SyntaxError) {
        this.toast.error('Invalid JSON file — could not parse backup');
      }
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
