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
import type { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { type ChartJsModule, loadChartJs } from '../utils/chart-js.loader';

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<div class="chart-wrapper" [style.height.px]="height"><canvas #canvas></canvas></div>`,
  styles: [
    `
      .chart-wrapper {
        position: relative;
        width: 100%;
      }

      @media (max-width: 768px) {
        .chart-wrapper {
          min-height: 220px;
        }
      }
    `,
  ],
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) type!: ChartType;
  @Input({ required: true }) data!: ChartData;
  @Input() options: ChartConfiguration['options'] = {};
  @Input() height = 280;

  private chartJs: ChartJsModule | null = null;
  private chart: InstanceType<ChartJsModule['Chart']> | null = null;
  private chartType: ChartType | null = null;
  private viewReady = false;
  private resizeObserver: ResizeObserver | null = null;

  async ngAfterViewInit(): Promise<void> {
    this.chartJs = await loadChartJs();
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
    this.chartJs = null;
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
    if (!this.viewReady || !this.chartJs || !this.data?.datasets?.length) {
      return;
    }

    const { Chart } = this.chartJs;
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
