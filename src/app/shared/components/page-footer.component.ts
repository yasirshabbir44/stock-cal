import { Component } from '@angular/core';
import { GITHUB_REPO_URL } from '../../core/constants/app-links';

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
        <a
          class="footer-source-link"
          [href]="githubRepoUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.75.08-.73.08-.73 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.01 2.05.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.3 0 .32.22.7.82.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          View source on GitHub
        </a>
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

      .footer-source-link {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        margin-top: 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--text-muted);
        text-decoration: none;
        transition: color 0.15s ease;
      }

      .footer-source-link:hover {
        color: var(--accent-gold);
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
export class PageFooterComponent {
  readonly githubRepoUrl = GITHUB_REPO_URL;
}
