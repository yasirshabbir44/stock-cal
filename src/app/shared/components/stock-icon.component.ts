import { Component, computed, input, signal } from '@angular/core';
import { getStockInitials, getStockLogoUrl } from '../../core/utils/stock-logo.util';

@Component({
  selector: 'app-stock-icon',
  standalone: true,
  template: `
    <span class="stock-icon" [class.stock-icon--sm]="size() === 'sm'" [class.stock-icon--md]="size() === 'md'">
      @if (showImage()) {
        <img [src]="resolvedLogoUrl()" [alt]="symbol() + ' logo'" (error)="onImageError()" />
      } @else {
        <span class="stock-icon__fallback">{{ initials() }}</span>
      }
    </span>
  `,
  styles: [
    `
      .stock-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: 8px;
        overflow: hidden;
        background: var(--surface-muted);
        border: 1px solid var(--border);
      }

      .stock-icon--sm {
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 6px;
      }

      .stock-icon--md {
        width: 2rem;
        height: 2rem;
      }

      .stock-icon img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #fff;
      }

      .stock-icon__fallback {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-muted);
      }

      .stock-icon--md .stock-icon__fallback {
        font-size: 0.75rem;
      }
    `,
  ],
})
export class StockIconComponent {
  readonly symbol = input.required<string>();
  readonly logoUrl = input<string | undefined>();
  readonly size = input<'sm' | 'md'>('sm');

  private readonly imageFailed = signal(false);

  readonly resolvedLogoUrl = computed(() => this.logoUrl() || getStockLogoUrl(this.symbol()));
  readonly initials = computed(() => getStockInitials(this.symbol()));
  readonly showImage = computed(() => !!this.symbol() && !this.imageFailed());

  onImageError(): void {
    this.imageFailed.set(true);
  }
}
