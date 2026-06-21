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
import type { ChartConfiguration, ChartData } from 'chart.js';

type ChartJsModule = typeof import('chart.js');

@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `<div class="sparkline-wrapper"><canvas #canvas></canvas></div>`,
  styles: [
    `
      .sparkline-wrapper {
        position: relative;
        width: 100%;
        height: 36px;
        margin-top: 0.625rem;
      }
    `,
  ],
})
export class SparklineComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) data!: number[];
  @Input() color = '#10b981';

  private chartJs: ChartJsModule | null = null;
  private chart: InstanceType<ChartJsModule['Chart']> | null = null;
  private viewReady = false;

  async ngAfterViewInit(): Promise<void> {
    const chartJs = await import('chart.js');
    chartJs.Chart.register(...chartJs.registerables);
    this.chartJs = chartJs;
    this.viewReady = true;
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }

    if (changes['data'] || changes['color']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
    this.chartJs = null;
  }

  private renderChart(): void {
    if (!this.viewReady || !this.chartJs || !this.data?.length) {
      return;
    }

    const { Chart } = this.chartJs;
    const chartData: ChartData<'line'> = {
      labels: this.data.map((_, i) => i),
      datasets: [
        {
          data: this.data,
          borderColor: this.color,
          backgroundColor: `${this.color}22`,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    };

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        interaction: { mode: 'index', intersect: false },
      },
    };

    if (this.chart) {
      this.chart.data = chartData;
      this.chart.update();
    } else {
      this.chart = new Chart(this.canvasRef.nativeElement, config);
    }
  }
}
