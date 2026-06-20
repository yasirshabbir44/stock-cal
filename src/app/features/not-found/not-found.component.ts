import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found">
      <span class="code">404</span>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <a routerLink="/home" class="btn-primary">Back to Home</a>
    </section>
  `,
  styles: [
    `
      .not-found {
        text-align: center;
        padding: 4rem 2rem;
      }

      .code {
        display: block;
        font-size: 4rem;
        font-weight: 800;
        background: linear-gradient(135deg, var(--accent-wealth), var(--accent-income));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        line-height: 1;
        margin-bottom: 1rem;
      }

      h1 {
        margin: 0 0 0.5rem;
      }

      p {
        margin: 0 0 2rem;
        color: var(--text-muted);
      }
    `,
  ],
})
export class NotFoundComponent {}
