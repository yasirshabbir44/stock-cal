import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from './toast.service';

const DEFAULT_SAVED_MESSAGE = 'Saved to local storage';
const TOAST_DEBOUNCE_MS = 450;

@Injectable({ providedIn: 'root' })
export class SaveFeedbackService {
  private readonly toast = inject(ToastService);
  private readonly flashing = signal<ReadonlySet<string>>(new Set());
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingToastMessage = DEFAULT_SAVED_MESSAGE;

  readonly flashKeys = this.flashing.asReadonly();

  isFlashing(key: string): boolean {
    return this.flashing().has(key);
  }

  flash(key: string, durationMs = 1200): void {
    this.flashing.update((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });

    setTimeout(() => {
      this.flashing.update((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }, durationMs);
  }

  /** Brief highlight for live-only value changes (sliders, simulators). */
  flashValue(key: string, durationMs = 600): void {
    this.flash(key, durationMs);
  }

  /** Cell flash plus a debounced toast for persisted edits. */
  persisted(key: string, message = DEFAULT_SAVED_MESSAGE, showToast = true): void {
    this.flash(key);
    if (!showToast) {
      return;
    }
    this.pendingToastMessage = message;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.toast.show(this.pendingToastMessage, 'success', 2200);
      this.toastTimer = null;
    }, TOAST_DEBOUNCE_MS);
  }

  saved(message = DEFAULT_SAVED_MESSAGE): void {
    this.toast.show(message, 'success', 2200);
  }
}
