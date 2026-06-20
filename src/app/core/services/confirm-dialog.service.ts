import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly state = signal<ConfirmState | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.state.set({
        ...options,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        resolve,
      });
    });
  }

  accept(): void {
    const current = this.state();
    if (current) {
      current.resolve(true);
      this.state.set(null);
    }
  }

  dismiss(): void {
    const current = this.state();
    if (current) {
      current.resolve(false);
      this.state.set(null);
    }
  }
}
