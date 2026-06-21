import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class QuickAddService {
  readonly open = signal(false);
  readonly initialTicker = signal('');

  show(ticker = ''): void {
    this.initialTicker.set(ticker.trim().toUpperCase());
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.initialTicker.set('');
  }
}
