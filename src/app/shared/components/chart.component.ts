import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartType,
  registerables,
} from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<div class="chart-wrapper"><canvas #canvas></canvas></div>`,
  styles: [
    `
      .chart-wrapper {
        position: relative;
        width: 100%;
        height: 280px;
      }
    `,
  ],
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) type!: ChartType;
  @Input({ required: true }) data!: ChartData;
  @Input() options: ChartConfiguration['options'] = {};

  private chart: Chart | null = null;
  private chartType: ChartType | null = null;
  private viewReady = false;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
    this.observeResize();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }

    if (changes['data'] || changes['options'] || changes['type']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.destroy();
    this.chart = null;
    this.chartType = null;
  }

  private observeResize(): void {
    const container = this.canvasRef.nativeElement.parentElement;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.resize();
    });
    this.resizeObserver.observe(container);
  }

  private renderChart(): void {
    if (!this.viewReady || !this.data?.datasets?.length) {
      return;
    }

    const config: ChartConfiguration = {
      type: this.type,
      data: this.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this.options,
      },
    };

    if (this.chart && this.chartType !== this.type) {
      this.chart.destroy();
      this.chart = null;
      this.chartType = null;
    }

    if (this.chart) {
      this.chart.data = this.data;
      this.chart.options = config.options ?? {};
      this.chart.update();
    } else {
      this.chart = new Chart(this.canvasRef.nativeElement, config);
      this.chartType = this.type;
    }

    queueMicrotask(() => this.chart?.resize());
  }
}
