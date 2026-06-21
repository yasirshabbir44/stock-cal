import {
  Component,
  ElementRef,
  forwardRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { StockApiService } from '../../core/services/stock-api.service';
import { StockSuggestion } from '../../core/models/stock-search.model';
import { StockIconComponent } from './stock-icon.component';

const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

@Component({
  selector: 'app-ticker-autocomplete',
  standalone: true,
  imports: [FormsModule, StockIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TickerAutocompleteComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ticker-autocomplete" (keydown)="onKeydown($event)">
      <div class="input-wrap">
        @if (displaySymbol()) {
          <app-stock-icon [symbol]="displaySymbol()" [logoUrl]="selectedSuggestion()?.logoUrl" size="sm" />
        }
        <input
          #inputEl
          type="text"
          [id]="inputId()"
          [name]="name()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [(ngModel)]="query"
          (ngModelChange)="onQueryChange($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
          autocomplete="off"
          spellcheck="false"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="listboxId"
          [attr.aria-activedescendant]="activeId()"
        />
        @if (loading()) {
          <span class="spinner" aria-hidden="true"></span>
        }
      </div>

      @if (open() && suggestions().length > 0) {
        <ul
          class="suggestions"
          [id]="listboxId"
          role="listbox"
          (mousedown)="$event.preventDefault()"
        >
          @if (!query.trim()) {
            <li class="suggestions-header" role="presentation">Popular stocks</li>
          }
          @for (item of suggestions(); track item.symbol; let i = $index) {
            <li
              role="option"
              [id]="optionId(i)"
              class="suggestion-item"
              [class.active]="activeIndex() === i"
              [attr.aria-selected]="activeIndex() === i"
              (mouseenter)="activeIndex.set(i)"
              (click)="select(item)"
            >
              <app-stock-icon [symbol]="item.symbol" [logoUrl]="item.logoUrl" size="sm" />
              <div class="suggestion-text">
                <span class="symbol">{{ item.symbol }}</span>
                <span class="name">{{ item.name }}</span>
              </div>
              <span class="type">{{ item.type }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .ticker-autocomplete {
        position: relative;
      }

      .input-wrap {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .input-wrap app-stock-icon {
        margin-left: 0.625rem;
      }

      input {
        width: 100%;
        padding: 0.625rem 0.75rem;
        padding-left: 0.5rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--surface-muted);
        color: var(--text-primary);
        font-size: 1rem;
        font-family: inherit;
        text-transform: uppercase;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      input:hover:not(:disabled):not(:focus) {
        border-color: color-mix(in srgb, var(--border) 50%, var(--accent-wealth));
      }

      .input-wrap:has(app-stock-icon) input {
        padding-left: 0;
      }

      input:focus {
        outline: 2px solid var(--accent-wealth);
        outline-offset: 1px;
      }

      input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .spinner {
        position: absolute;
        right: 0.75rem;
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--border);
        border-top-color: var(--accent-wealth);
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      .suggestions {
        position: absolute;
        top: calc(100% + 0.375rem);
        left: 0;
        right: 0;
        z-index: 20;
        margin: 0;
        padding: 0.375rem;
        list-style: none;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        box-shadow: var(--shadow-lg);
        max-height: 280px;
        overflow-y: auto;
      }

      .suggestions-header {
        padding: 0.375rem 0.625rem;
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
      }

      .suggestion-item {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.5rem 0.625rem;
        border-radius: 8px;
        cursor: pointer;
      }

      .suggestion-item.active,
      .suggestion-item:hover {
        background: var(--accent-wealth-muted);
      }

      .suggestion-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }

      .symbol {
        font-weight: 700;
        font-size: 0.875rem;
      }

      .name {
        font-size: 0.75rem;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .type {
        flex-shrink: 0;
        font-size: 0.6875rem;
        color: var(--text-muted);
        padding: 0.125rem 0.375rem;
        border-radius: 999px;
        background: var(--surface-muted);
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class TickerAutocompleteComponent implements ControlValueAccessor, OnDestroy {
  private readonly stockApi = inject(StockApiService);

  readonly inputId = input('ticker-input');
  readonly name = input('ticker');
  readonly placeholder = input('Search ticker or company…');

  readonly selected = output<StockSuggestion>();

  readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  readonly listboxId = `ticker-list-${Math.random().toString(36).slice(2, 9)}`;

  query = '';
  disabled = signal(false);
  open = signal(false);
  loading = signal(false);
  suggestions = signal<StockSuggestion[]>([]);
  activeIndex = signal(-1);
  selectedSuggestion = signal<StockSuggestion | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private searchVersion = 0;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngOnDestroy(): void {
    this.clearTimers();
  }

  displaySymbol(): string {
    return this.selectedSuggestion()?.symbol || this.query.trim().toUpperCase();
  }

  activeId(): string | null {
    const index = this.activeIndex();
    return index >= 0 ? this.optionId(index) : null;
  }

  optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  writeValue(value: string): void {
    const normalized = (value ?? '').toUpperCase();
    this.query = normalized;

    if (!normalized) {
      this.selectedSuggestion.set(null);
    } else if (this.selectedSuggestion()?.symbol !== normalized) {
      this.selectedSuggestion.set(null);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onQueryChange(value: string): void {
    const normalized = value.toUpperCase();
    this.query = normalized;
    this.onChange(normalized);

    if (this.selectedSuggestion()?.symbol !== normalized) {
      this.selectedSuggestion.set(null);
    }

    this.scheduleSearch(normalized);
  }

  onFocus(): void {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }

    this.open.set(true);
    this.scheduleSearch(this.query);
  }

  onBlur(): void {
    this.onTouched();
    this.blurTimer = setTimeout(() => {
      this.open.set(false);
      this.activeIndex.set(-1);
    }, 150);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.open() || this.suggestions().length === 0) {
      return;
    }

    const lastIndex = this.suggestions().length - 1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = this.activeIndex() < lastIndex ? this.activeIndex() + 1 : 0;
      this.activeIndex.set(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = this.activeIndex() > 0 ? this.activeIndex() - 1 : lastIndex;
      this.activeIndex.set(prev);
    } else if (event.key === 'Enter') {
      const index = this.activeIndex();
      if (index >= 0) {
        event.preventDefault();
        this.select(this.suggestions()[index]);
      }
    } else if (event.key === 'Escape') {
      this.open.set(false);
      this.activeIndex.set(-1);
    }
  }

  select(item: StockSuggestion): void {
    this.query = item.symbol;
    this.selectedSuggestion.set(item);
    this.onChange(item.symbol);
    this.selected.emit(item);
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  focus(): void {
    this.inputEl()?.nativeElement.focus();
  }

  static isValidTicker(value: string): boolean {
    return TICKER_PATTERN.test(value.trim().toUpperCase());
  }

  private scheduleSearch(query: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.runSearch(query);
    }, 250);
  }

  private async runSearch(query: string): Promise<void> {
    const version = ++this.searchVersion;
    this.loading.set(true);

    try {
      const results = await this.stockApi.searchSymbols(query);
      if (version !== this.searchVersion) {
        return;
      }

      this.suggestions.set(results);
      this.open.set(true);
      this.activeIndex.set(results.length > 0 ? 0 : -1);
    } finally {
      if (version === this.searchVersion) {
        this.loading.set(false);
      }
    }
  }

  private clearTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
    }
  }
}
