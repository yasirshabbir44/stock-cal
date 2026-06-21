import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type {
  DashboardWidgetLayout,
  HomeWidgetId,
  SavedDashboardLayout,
} from '../models/dashboard-layout.model';

const STORAGE_PREFIX = 'stock-cal-dashboard-layout';

@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  private readonly platformId = inject(PLATFORM_ID);

  loadLayout(dashboardId: string, defaults: DashboardWidgetLayout[]): DashboardWidgetLayout[] {
    if (!isPlatformBrowser(this.platformId)) {
      return defaults.map((item) => ({ ...item }));
    }

    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${dashboardId}`);
    if (!raw) {
      return defaults.map((item) => ({ ...item }));
    }

    try {
      const saved = JSON.parse(raw) as SavedDashboardLayout;
      if (saved.version !== 1 || !Array.isArray(saved.widgets)) {
        return defaults.map((item) => ({ ...item }));
      }

      return this.mergeWithDefaults(saved.widgets, defaults);
    } catch {
      return defaults.map((item) => ({ ...item }));
    }
  }

  saveLayout(dashboardId: string, layout: DashboardWidgetLayout[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const payload: SavedDashboardLayout = {
      version: 1,
      widgets: layout.map(({ id, x, y, cols, rows }) => ({ id, x, y, cols, rows })),
    };

    localStorage.setItem(`${STORAGE_PREFIX}:${dashboardId}`, JSON.stringify(payload));
  }

  resetLayout(dashboardId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(`${STORAGE_PREFIX}:${dashboardId}`);
  }

  private mergeWithDefaults(
    saved: SavedDashboardLayout['widgets'],
    defaults: DashboardWidgetLayout[],
  ): DashboardWidgetLayout[] {
    const savedById = new Map(saved.map((item) => [item.id, item]));

    return defaults.map((defaultsItem) => {
      const savedItem = savedById.get(defaultsItem.id);
      if (!savedItem) {
        return { ...defaultsItem };
      }

      return {
        ...defaultsItem,
        x: savedItem.x,
        y: savedItem.y,
        cols: clamp(savedItem.cols, defaultsItem.minItemCols ?? 1, defaultsItem.maxItemCols ?? 12),
        rows: clamp(savedItem.rows, defaultsItem.minItemRows ?? 1, defaultsItem.maxItemRows ?? 12),
      };
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isHomeWidgetId(value: string): value is HomeWidgetId {
  return [
    'income-goal',
    'portfolio-growth',
    'dividend-calendar',
    'asset-allocation',
    'top-holdings',
    'milestones',
    'alerts',
    'explore',
  ].includes(value);
}
