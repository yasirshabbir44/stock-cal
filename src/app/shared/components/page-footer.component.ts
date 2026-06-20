import { Component } from '@angular/core';

@Component({
  selector: 'app-page-footer',
  standalone: true,
  template: `
    <footer class="page-footer">
      <p>
        <strong>StockCal</strong> — Your portfolio stays on this device. No account required.
      </p>
      <p class="footer-meta">Wealth &amp; dividend income tracker</p>
    </footer>
  `,
  styles: [
    `
      .page-footer {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem 1.5rem 5rem;
        text-align: center;
        border-top: 1px solid var(--border);
      }

      p {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
      }

      .footer-meta {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        opacity: 0.7;
      }

      @media (max-width: 768px) {
        .page-footer {
          padding-bottom: 6rem;
        }
      }
    `,
  ],
})
export class PageFooterComponent {}
