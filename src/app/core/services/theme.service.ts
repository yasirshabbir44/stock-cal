import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'stockcal-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private mediaQuery: MediaQueryList | null = null;
  private readonly onSystemThemeChange = (): void => {
    if (this.preference() === 'system') {
      this.applyResolved(this.resolveSystemTheme());
    }
  };

  readonly preference = signal<ThemePreference>('system');
  readonly theme = signal<Theme>('dark');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      const initial = stored && this.isThemePreference(stored) ? stored : 'system';
      this.applyPreference(initial, false);
      this.bindSystemThemeListener();
    }
  }

  toggle(): void {
    this.setPreference(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setPreference(preference: ThemePreference): void {
    this.applyPreference(preference, true);
  }

  /** @deprecated Use setPreference — kept for header toggle compatibility */
  setTheme(theme: Theme): void {
    this.setPreference(theme);
  }

  private applyPreference(preference: ThemePreference, persist: boolean): void {
    this.preference.set(preference);
    const resolved = preference === 'system' ? this.resolveSystemTheme() : preference;
    this.applyResolved(resolved);

    if (persist && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  }

  private applyResolved(theme: Theme): void {
    this.theme.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  private bindSystemThemeListener(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    this.mediaQuery.addEventListener('change', this.onSystemThemeChange);
  }

  private resolveSystemTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) {
      return 'dark';
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  private isThemePreference(value: string): value is ThemePreference {
    return value === 'dark' || value === 'light' || value === 'system';
  }
}
