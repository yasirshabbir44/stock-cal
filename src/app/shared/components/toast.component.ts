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

      @media (max-width: 768px) {
        .toast-container {
          bottom: calc(4.5rem + env(safe-area-inset-bottom));
          left: 1rem;
          right: 1rem;
        }
      }

      .toast {
        padding: 0.875rem 1rem;
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        animation: slideIn 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .toast::before {
        content: '';
        flex-shrink: 0;
        width: 0.375rem;
        height: 0.375rem;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.7;
      }

      .success::before {
        opacity: 1;
      }

      .success {
        background: var(--toast-success-bg);
        color: var(--toast-success-text);
        border: 1px solid var(--toast-success-border);
      }

      .error {
        background: var(--toast-error-bg);
        color: var(--toast-error-text);
        border: 1px solid var(--toast-error-border);
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
