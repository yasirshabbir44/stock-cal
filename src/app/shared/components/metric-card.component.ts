import { Component, Input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [DecimalPipe, CurrencyPipe],
  template: `
    <article
      class="metric-card"
      [class.positive]="positive"
      [class.negative]="negative"
      [class.accent-wealth]="accent === 'wealth'"
      [class.accent-income]="accent === 'income'"
      [class.accent-gold]="accent === 'gold'"
    >
      <p class="metric-label">{{ label }}</p>
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

      .metric-label {
        margin: 0 0 0.625rem;
        font-size: 0.6875rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
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
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number;
  @Input() textValue = '';
  @Input() subtitle = '';
  @Input() isCurrency = false;
  @Input() isPercent = false;
  @Input() positive = false;
  @Input() negative = false;
  @Input() accent: 'wealth' | 'income' | 'gold' | '' = '';
}
