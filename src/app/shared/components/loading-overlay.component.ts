import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    @if (visible) {
      <div class="overlay" role="status" aria-live="polite">
        <div class="spinner"></div>
        <p>{{ message }}</p>
      </div>
    }
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 900;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        background: rgba(15, 20, 25, 0.72);
        backdrop-filter: blur(4px);
      }

      .spinner {
        width: 2.5rem;
        height: 2.5rem;
        border: 3px solid var(--border);
        border-top-color: var(--accent-wealth);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }

      p {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.875rem;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoadingOverlayComponent {
  @Input() visible = false;
  @Input() message = 'Loading…';
}
