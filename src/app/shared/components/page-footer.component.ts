import { Component } from '@angular/core';

@Component({
  selector: 'app-page-footer',
  standalone: true,
  template: `
    <footer class="page-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="footer-logo" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <strong>StockCal</strong>
        </div>
        <p class="footer-tagline">Professional portfolio intelligence — private, on-device, no account required.</p>
        <p class="footer-disclaimer">
          For informational purposes only. Not financial advice. Market data may be delayed.
        </p>
      </div>
    </footer>
  `,
  styles: [
    `
      .page-footer {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2.5rem 1.5rem 5rem;
        border-top: 1px solid var(--border-subtle);
      }

      .footer-inner {
        text-align: center;
        max-width: 480px;
        margin: 0 auto;
      }

      .footer-brand {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.625rem;
      }

      .footer-logo {
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 6px;
        background: var(--accent-gold-muted);
        color: var(--accent-gold);
      }

      .footer-brand strong {
        font-family: var(--font-display);
        font-size: 0.9375rem;
        font-weight: 600;
      }

      .footer-tagline {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
        line-height: 1.5;
      }

      .footer-disclaimer {
        margin: 0.75rem 0 0;
        font-size: 0.6875rem;
        color: var(--text-muted);
        opacity: 0.65;
        line-height: 1.45;
      }

      @media (max-width: 768px) {
        .page-footer {
          padding: 1.75rem 1rem 6rem;
        }
      }
    `,
  ],
})
export class PageFooterComponent {}
