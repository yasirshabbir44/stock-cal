import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';

@Component({
  selector: 'app-quick-add-holding',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close()" role="presentation">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="quick-add-title" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <div>
              <h2 id="quick-add-title">Add Stock</h2>
              <p>Enter a ticker and your position details.</p>
            </div>
            <button type="button" class="close-btn" (click)="close()" aria-label="Close">×</button>
          </header>

          <div class="quick-picks">
            @for (t of quickTickers; track t) {
              <button type="button" class="chip" (click)="ticker = t">{{ t }}</button>
            }
          </div>

          <form class="add-form" (ngSubmit)="submit()">
            <label [class.has-error]="errors.ticker">
              Ticker
              <input
                type="text"
                [(ngModel)]="ticker"
                name="ticker"
                placeholder="e.g. AAPL"
                autocomplete="off"
                style="text-transform: uppercase"
              />
              @if (errors.ticker) {
                <span class="field-error">{{ errors.ticker }}</span>
              }
            </label>
            <label [class.has-error]="errors.shares">
              Shares
              <input type="number" [(ngModel)]="shares" name="shares" placeholder="100" min="0.0001" step="any" />
              @if (errors.shares) {
                <span class="field-error">{{ errors.shares }}</span>
              }
            </label>
            <label [class.has-error]="errors.purchasePrice">
              Purchase Price
              <input type="number" [(ngModel)]="purchasePrice" name="purchasePrice" placeholder="150.00" min="0.01" step="0.01" />
              @if (errors.purchasePrice) {
                <span class="field-error">{{ errors.purchasePrice }}</span>
              }
            </label>
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="close()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="submitting()">
                {{ submitting() ? 'Adding…' : 'Add to Portfolio' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 1050;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: var(--overlay-bg);
        backdrop-filter: blur(4px);
        animation: fadeIn 0.15s ease;
      }

      .modal {
        width: min(480px, 100%);
        padding: 1.5rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: var(--shadow-lg);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
      }

      .modal-header p {
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
        color: var(--text-muted);
      }

      .close-btn {
        border: none;
        background: var(--surface-muted);
        color: var(--text-muted);
        width: 2rem;
        height: 2rem;
        border-radius: 8px;
        font-size: 1.25rem;
        cursor: pointer;
        line-height: 1;
      }

      .quick-picks {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
      }

      .add-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-muted);
      }

      label.has-error input {
        border-color: var(--danger);
      }

      input {
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface-muted);
        color: var(--text-primary);
        font-size: 1rem;
      }

      input:focus {
        outline: 2px solid var(--accent-wealth);
        outline-offset: 1px;
      }

      .field-error {
        font-size: 0.8125rem;
        color: var(--danger);
        font-weight: 500;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class QuickAddHoldingComponent {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly open = input(false);
  readonly initialTicker = input('');
  readonly closed = output<void>();
  readonly added = output<void>();

  ticker = '';
  shares: number | null = null;
  purchasePrice: number | null = null;
  submitting = signal(false);
  errors: { ticker?: string; shares?: string; purchasePrice?: string } = {};

  readonly quickTickers = ['AAPL', 'MSFT', 'SCHD', 'O', 'KO', 'JNJ'];

  constructor() {
    effect(() => {
      if (this.open()) {
        const initial = this.initialTicker().trim().toUpperCase();
        if (initial) {
          this.ticker = initial;
        }
      }
    });
  }

  close(): void {
    this.reset();
    this.closed.emit();
  }

  async submit(): Promise<void> {
    this.errors = {};

    const ticker = this.ticker.trim().toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
      this.errors.ticker = 'Enter a valid ticker (1–5 letters)';
    }
    if (!this.shares || this.shares <= 0) {
      this.errors.shares = 'Shares must be greater than 0';
    }
    if (!this.purchasePrice || this.purchasePrice <= 0) {
      this.errors.purchasePrice = 'Price must be greater than 0';
    }

    if (Object.keys(this.errors).length > 0) {
      return;
    }

    this.submitting.set(true);
    try {
      await this.portfolio.addHolding({
        ticker,
        shares: this.shares!,
        purchasePrice: this.purchasePrice!,
      });
      this.added.emit();
      this.close();
    } catch {
      // toast handled in facade
    } finally {
      this.submitting.set(false);
    }
  }

  private reset(): void {
    this.ticker = '';
    this.shares = null;
    this.purchasePrice = null;
    this.errors = {};
  }
}
