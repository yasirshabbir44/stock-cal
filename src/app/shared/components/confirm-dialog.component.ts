import { Component, HostListener, inject } from '@angular/core';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (dialog.state(); as s) {
      <div class="modal-backdrop modal-backdrop--confirm" (click)="dialog.dismiss()" role="presentation">
        <div
          class="modal-shell modal-shell--narrow"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-title'"
          (click)="$event.stopPropagation()"
        >
          <h2 id="confirm-title">{{ s.title }}</h2>
          <p>{{ s.message }}</p>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="dialog.dismiss()">
              {{ s.cancelLabel }}
            </button>
            <button
              type="button"
              [class]="s.danger ? 'btn-danger-solid' : 'btn-primary'"
              (click)="dialog.accept()"
            >
              {{ s.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly dialog = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.state()) {
      this.dialog.dismiss();
    }
  }
}
