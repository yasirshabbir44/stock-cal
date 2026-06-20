import {
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
        height: 100%;
        min-height: 280px;
      }
    `,
  ],
})
export class ChartComponent implements OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) type!: ChartType;
  @Input({ required: true }) data!: ChartData;
  @Input() options: ChartConfiguration['options'] = {};

  private chart: Chart | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['options'] || changes['type']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.data) {
      return;
    }

    this.chart?.destroy();
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: this.type,
      data: this.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this.options,
      },
    });
  }
}
