import { Component, HostListener, inject } from '@angular/core';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (dialog.state(); as s) {
      <div class="backdrop" (click)="dialog.dismiss()" role="presentation">
        <div
          class="modal"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-title'"
          (click)="$event.stopPropagation()"
        >
          <h2 id="confirm-title">{{ s.title }}</h2>
          <p>{{ s.message }}</p>
          <div class="actions">
            <button type="button" class="btn-secondary" (click)="dialog.dismiss()">
              {{ s.cancelLabel }}
            </button>
            <button
              type="button"
              [class]="s.danger ? 'btn-danger-solid' : 'btn-primary'"
              (click)="dialog.accept()"
            >
              {{ s.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: var(--overlay-bg);
        backdrop-filter: blur(4px);
        animation: fadeIn 0.15s ease;
      }

      .modal {
        width: min(420px, 100%);
        padding: 1.5rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        box-shadow: var(--shadow-lg);
      }

      h2 {
        margin: 0 0 0.5rem;
        font-size: 1.125rem;
      }

      p {
        margin: 0 0 1.5rem;
        color: var(--text-muted);
        line-height: 1.5;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }

      .btn-danger-solid {
        border: none;
        border-radius: 8px;
        padding: 0.625rem 1.125rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        background: var(--danger);
        color: white;
      }

      @media (max-width: 768px) {
        .backdrop {
          align-items: flex-end;
          padding: 0;
        }

        .modal {
          width: 100%;
          border-radius: 16px 16px 0 0;
          padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
        }

        .actions {
          flex-direction: column-reverse;
        }

        .actions button {
          width: 100%;
        }
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly dialog = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.state()) {
      this.dialog.dismiss();
    }
  }
}
