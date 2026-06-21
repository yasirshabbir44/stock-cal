import { Component, ElementRef, HostListener, Input, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { SparklineComponent } from './sparkline.component';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [DecimalPipe, CurrencyPipe, SparklineComponent],
  template: `
    <article
      class="metric-card"
      [class.positive]="positive"
      [class.negative]="negative"
      [class.accent-wealth]="accent === 'wealth'"
      [class.accent-income]="accent === 'income'"
      [class.accent-gold]="accent === 'gold'"
      [class.formula-open]="showFormula"
    >
      <div class="metric-label-row">
        <p class="metric-label">{{ label }}</p>
        @if (formula) {
          <button
            type="button"
            class="formula-info-btn"
            [attr.aria-label]="'How ' + label + ' is calculated'"
            [attr.aria-expanded]="showFormula"
            (click)="toggleFormula($event)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
              <path d="M12 10v6M12 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          @if (showFormula) {
            <div class="formula-popover" role="tooltip" (click)="$event.stopPropagation()">
              <p class="formula-heading">Formula</p>
              <p class="formula-text">{{ formula }}</p>
            </div>
          }
        }
      </div>
      <p class="metric-value">
        @if (textValue) {
          {{ textValue }}
        } @else if (isPercent) {
          {{ value | number: '1.2-2' }}%
        } @else if (isCurrency) {
          {{ value | currency: 'USD' : 'symbol' : '1.2-2' }}
        } @else {
          {{ value | number: '1.0-2' }}
        }
      </p>
      @if (sparklineData.length >= 2) {
        <app-sparkline [data]="sparklineData" [color]="sparklineColor" />
      }
      @if (subtitle) {
        <p class="metric-subtitle">{{ subtitle }}</p>
      }
    </article>
  `,
  styles: [
    `
      .metric-card {
        position: relative;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 1.25rem 1.25rem 1.125rem;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
      }

      .metric-card.formula-open {
        overflow: visible;
        z-index: 2;
      }

      .metric-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--accent-wealth), var(--accent-gold));
        opacity: 0.65;
      }

      .metric-card.accent-income::before {
        background: linear-gradient(90deg, var(--accent-income), #6ee7b7);
      }

      .metric-card.accent-gold::before {
        background: linear-gradient(90deg, var(--accent-gold), #f0d78c);
      }

      .metric-card:hover {
        border-color: color-mix(in srgb, var(--accent-wealth) 35%, var(--border));
        box-shadow: var(--shadow-md);
        transform: translateY(-1px);
      }

      .metric-label-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.375rem;
        margin-bottom: 0.625rem;
      }

      .metric-label {
        margin: 0;
        font-size: 0.6875rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .formula-info-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 1.125rem;
        height: 1.125rem;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }

      .formula-info-btn:hover,
      .formula-info-btn:focus-visible {
        color: var(--accent-wealth);
        background: var(--accent-wealth-muted);
        outline: none;
      }

      .formula-popover {
        position: absolute;
        top: calc(100% + 0.375rem);
        left: 0;
        z-index: 10;
        min-width: 14rem;
        max-width: min(18rem, calc(100vw - 2rem));
        padding: 0.75rem 0.875rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--bg-elevated);
        box-shadow: var(--shadow-md);
      }

      .formula-heading {
        margin: 0 0 0.375rem;
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
      }

      .formula-text {
        margin: 0;
        font-size: 0.8125rem;
        line-height: 1.5;
        color: var(--text-primary);
      }

      .metric-value {
        margin: 0;
        font-size: 1.625rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--text-primary);
        line-height: 1.15;
        letter-spacing: -0.02em;
        word-break: break-word;
      }

      .metric-subtitle {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
        line-height: 1.45;
      }

      .positive .metric-value {
        color: var(--success);
      }

      .negative .metric-value {
        color: var(--danger);
      }

      @media (max-width: 768px) {
        .metric-card {
          padding: 1rem;
        }

        .metric-value {
          font-size: 1.3125rem;
        }

        .metric-label {
          font-size: 0.625rem;
        }
      }
    `,
  ],
})
export class MetricCardComponent {
  private readonly elementRef = inject(ElementRef);

  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number;
  @Input() textValue = '';
  @Input() subtitle = '';
  @Input() formula = '';
  @Input() isCurrency = false;
  @Input() isPercent = false;
  @Input() positive = false;
  @Input() negative = false;
  @Input() accent: 'wealth' | 'income' | 'gold' | '' = '';
  @Input() sparklineData: number[] = [];
  @Input() sparklineColor = '#10b981';

  showFormula = false;

  toggleFormula(event: Event): void {
    event.stopPropagation();
    this.showFormula = !this.showFormula;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showFormula) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showFormula = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showFormula = false;
  }
}
