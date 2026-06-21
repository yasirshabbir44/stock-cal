import { AfterViewInit, Directive, ElementRef, inject, input } from '@angular/core';

/** Binds a virtual row element to TanStack Virtual's dynamic size measurement. */
@Directive({
  selector: '[appVirtualRowMeasure]',
  standalone: true,
})
export class VirtualRowMeasureDirective implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly index = input<number | null>(null, { alias: 'appVirtualRowMeasure' });
  readonly measure = input<((element: Element) => void) | null>(null);

  ngAfterViewInit(): void {
    const index = this.index();
    const measure = this.measure();
    if (index == null || measure == null) {
      return;
    }

    const element = this.el.nativeElement;
    element.setAttribute('data-index', String(index));
    measure(element);
  }
}
