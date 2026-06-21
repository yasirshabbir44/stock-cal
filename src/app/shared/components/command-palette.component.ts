import {
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  viewChild,
} from '@angular/core';
import {
  CommandCategory,
  CommandPaletteService,
  PaletteCommand,
} from '../../core/services/command-palette.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: 'Navigate',
  actions: 'Actions',
  portfolio: 'Portfolio',
  settings: 'Settings',
  research: 'Research',
};

@Component({
  selector: 'app-command-palette',
  standalone: true,
  template: `
    @if (palette.open()) {
      <div class="palette-backdrop" (click)="palette.close()" role="presentation">
        <div
          class="palette-shell"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          (click)="$event.stopPropagation()"
        >
          <div class="palette-search">
            <svg class="palette-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.75"/>
              <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
            </svg>
            <input
              #searchInput
              type="text"
              class="palette-input"
              placeholder="Search commands…"
              [value]="palette.query()"
              (input)="onInput($event)"
              (keydown)="onSearchKeydown($event)"
              autocomplete="off"
              spellcheck="false"
              aria-label="Search commands"
              aria-controls="palette-results"
              [attr.aria-activedescendant]="'palette-item-' + palette.activeIndex()"
            />
            <kbd class="palette-kbd">esc</kbd>
          </div>

          <ul id="palette-results" class="palette-results" role="listbox">
            @if (palette.visibleCommands().length === 0) {
              <li class="palette-empty">No matching commands</li>
            } @else {
              @for (command of palette.visibleCommands(); track command.id; let i = $index) {
                <li>
                  <button
                    type="button"
                    class="palette-item"
                    [class.active]="i === palette.activeIndex()"
                    [id]="'palette-item-' + i"
                    role="option"
                    [attr.aria-selected]="i === palette.activeIndex()"
                    (click)="execute(command)"
                    (mouseenter)="palette.activeIndex.set(i)"
                  >
                    <span class="palette-item-main">
                      <span class="palette-item-label">{{ command.label }}</span>
                      @if (command.description) {
                        <span class="palette-item-desc">{{ command.description }}</span>
                      }
                    </span>
                    <span class="palette-item-meta">
                      <span class="palette-category">{{ categoryLabel(command.category) }}</span>
                    </span>
                  </button>
                </li>
              }
            }
          </ul>

          <footer class="palette-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> run</span>
            <span><kbd>{{ modKey }}</kbd><kbd>K</kbd> toggle</span>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .palette-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1080;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: min(12vh, 6rem) 1rem 1rem;
        background: var(--overlay-bg);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }

      .palette-shell {
        width: min(640px, 100%);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        animation: palette-in 0.14s ease-out;
      }

      @keyframes palette-in {
        from {
          opacity: 0;
          transform: translateY(-8px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .palette-search {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.875rem 1rem;
        border-bottom: 1px solid var(--border-subtle);
      }

      .palette-search-icon {
        flex-shrink: 0;
        color: var(--text-muted);
      }

      .palette-input {
        flex: 1;
        border: none;
        background: transparent;
        color: var(--text-primary);
        font: inherit;
        font-size: 1rem;
        outline: none;
        min-width: 0;
      }

      .palette-input::placeholder {
        color: var(--text-muted);
      }

      .palette-kbd {
        flex-shrink: 0;
        font-size: 0.6875rem;
        font-family: inherit;
        color: var(--text-muted);
        background: var(--surface-muted);
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        padding: 0.125rem 0.375rem;
        text-transform: uppercase;
      }

      .palette-results {
        list-style: none;
        margin: 0;
        padding: 0.375rem;
        max-height: min(50vh, 360px);
        overflow-y: auto;
      }

      .palette-empty {
        padding: 1.5rem 1rem;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.875rem;
      }

      .palette-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        width: 100%;
        padding: 0.625rem 0.75rem;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: background 0.1s;
      }

      .palette-item:hover,
      .palette-item.active {
        background: var(--nav-active-bg);
      }

      .palette-item-main {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        min-width: 0;
      }

      .palette-item-label {
        font-size: 0.9375rem;
        font-weight: 500;
      }

      .palette-item-desc {
        font-size: 0.8125rem;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .palette-item-meta {
        flex-shrink: 0;
      }

      .palette-category {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        background: var(--surface-muted);
        border: 1px solid var(--border-subtle);
        border-radius: 999px;
        padding: 0.125rem 0.5rem;
      }

      .palette-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1.25rem;
        padding: 0.625rem 1rem;
        border-top: 1px solid var(--border-subtle);
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      .palette-footer kbd {
        font-family: inherit;
        font-size: 0.6875rem;
        background: var(--surface-muted);
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        padding: 0.0625rem 0.3125rem;
        margin-right: 0.25rem;
      }

      @media (max-width: 768px) {
        .palette-backdrop {
          align-items: flex-end;
          padding: 0;
        }

        .palette-shell {
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          padding-bottom: env(safe-area-inset-bottom);
        }

        .palette-item-desc {
          white-space: normal;
        }
      }
    `,
  ],
})
export class CommandPaletteComponent {
  readonly palette = inject(CommandPaletteService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly modKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘'
    : 'Ctrl';

  constructor() {
    effect(() => {
      if (this.palette.open()) {
        queueMicrotask(() => this.searchInput()?.nativeElement.focus());
      }
    });
  }

  categoryLabel(category: CommandCategory): string {
    return CATEGORY_LABELS[category];
  }

  onInput(event: Event): void {
    this.palette.setQuery((event.target as HTMLInputElement).value);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.palette.selectNext();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.palette.selectPrev();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void this.palette.executeActive();
    }
  }

  execute(command: PaletteCommand): void {
    void this.palette.execute(command);
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (!this.palette.canHandleGlobalShortcut()) {
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.palette.toggle();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm.state()) {
      return;
    }

    if (this.palette.open()) {
      this.palette.close();
    }
  }
}
