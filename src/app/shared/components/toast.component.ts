import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast" [class]="toast.type" (click)="dismiss(toast.id)">
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: min(360px, calc(100vw - 2rem));
      }

      .toast {
        padding: 0.875rem 1rem;
        border-radius: 10px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        animation: slideIn 0.2s ease;
      }

      .success {
        background: #14532d;
        color: #bbf7d0;
        border: 1px solid #22c55e;
      }

      .error {
        background: #450a0a;
        color: #fecaca;
        border: 1px solid #ef4444;
      }

      .info {
        background: var(--surface);
        color: var(--text-primary);
        border: 1px solid var(--border);
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
