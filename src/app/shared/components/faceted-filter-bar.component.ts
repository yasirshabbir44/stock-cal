import { Component, computed, input, output } from '@angular/core';
import { DividendFrequency } from '../../core/utils/dividend-frequency.util';
import { SourceFilter } from '../../core/models/portfolio-table-row.model';

@Component({
  selector: 'app-faceted-filter-bar',
  standalone: true,
  template: `
    <div class="filter-bar" role="search" aria-label="Portfolio filters">
      <div class="filter-row">
        <input
          type="search"
          class="form-input search-input"
          [value]="searchQuery()"
          (input)="searchChange.emit($any($event.target).value)"
          placeholder="Search ticker or company…"
          aria-label="Search holdings and watchlist"
        />

        <div class="source-toggle" role="group" aria-label="Data source">
          <span class="filter-label">Show:</span>
          @for (option of sourceOptions; track option.value) {
            <button
              type="button"
              class="filter-chip"
              [class.active]="sourceFilter() === option.value"
              [attr.aria-pressed]="sourceFilter() === option.value"
              (click)="sourceFilterChange.emit(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      <div class="filter-row">
        <div class="facet-group" role="group" aria-label="Dividend frequency">
          <span class="filter-label">Frequency:</span>
          @for (freq of frequencyOptions; track freq) {
            <button
              type="button"
              class="filter-chip"
              [class.active]="selectedFrequencies().has(freq)"
              [attr.aria-pressed]="selectedFrequencies().has(freq)"
              (click)="frequencyToggle.emit(freq)"
            >
              {{ freq === 'monthly' ? 'Monthly' : 'Quarterly' }}
            </button>
          }
        </div>

        @if (activeFilterCount() > 0) {
          <button type="button" class="clear-btn" (click)="clearFilters.emit()">
            Clear filters ({{ activeFilterCount() }})
          </button>
        }
      </div>

      @if (availableSectors().length > 0) {
        <div class="facet-group sector-facet" role="group" aria-label="Sector">
          <span class="filter-label">Sector:</span>
          @for (sector of availableSectors(); track sector) {
            <button
              type="button"
              class="filter-chip"
              [class.active]="selectedSectors().has(sector)"
              [attr.aria-pressed]="selectedSectors().has(sector)"
              (click)="sectorToggle.emit(sector)"
            >
              {{ sector }}
            </button>
          }
        </div>
      }

      <p class="filter-summary">
        Showing {{ filteredCount() }} of {{ totalCount() }} positions
        @if (activeFilterCount() > 0) {
          <span class="filtered-note">· filters active</span>
        }
      </p>
    </div>
  `,
  styles: `
    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      margin-bottom: 1rem;
    }

    .filter-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.625rem;
    }

    .facet-group,
    .source-toggle {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
    }

    .sector-facet {
      padding-top: 0.125rem;
    }

    .filter-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-right: 0.125rem;
    }

    .clear-btn {
      margin-left: auto;
      padding: 0.3125rem 0.625rem;
      border: none;
      background: transparent;
      color: var(--accent-wealth);
      font-size: 0.8125rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .filter-summary {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .filtered-note {
      color: var(--accent-wealth);
    }

    @media (max-width: 768px) {
      .search-input {
        flex: 1 1 100%;
        width: 100%;
      }

      .clear-btn {
        margin-left: 0;
      }
    }
  `,
})
export class FacetedFilterBarComponent {
  readonly searchQuery = input('');
  readonly sourceFilter = input<SourceFilter>('all');
  readonly selectedSectors = input<ReadonlySet<string>>(new Set());
  readonly selectedFrequencies = input<ReadonlySet<DividendFrequency>>(new Set());
  readonly availableSectors = input<string[]>([]);
  readonly filteredCount = input(0);
  readonly totalCount = input(0);

  readonly searchChange = output<string>();
  readonly sourceFilterChange = output<SourceFilter>();
  readonly sectorToggle = output<string>();
  readonly frequencyToggle = output<DividendFrequency>();
  readonly clearFilters = output<void>();

  readonly sourceOptions: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'portfolio', label: 'Portfolio' },
    { value: 'watchlist', label: 'Watchlist' },
  ];

  readonly frequencyOptions: DividendFrequency[] = ['monthly', 'quarterly'];

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.searchQuery().trim()) {
      count++;
    }
    if (this.sourceFilter() !== 'all') {
      count++;
    }
    count += this.selectedSectors().size;
    count += this.selectedFrequencies().size;
    return count;
  });
}
