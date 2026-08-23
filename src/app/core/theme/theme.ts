import { Injectable, signal } from '@angular/core';

export type ColorMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'mecfs.theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly mode = signal<ColorMode>(this.readMode());

  constructor() {
    this.apply(this.mode());
  }

  toggle(): void {
    this.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  set(mode: ColorMode): void {
    this.mode.set(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    this.apply(mode);
  }

  private apply(mode: ColorMode): void {
    const root = document.documentElement;
    root.style.colorScheme = mode;
    root.setAttribute('data-color-scheme', mode);

    const themeColor = mode === 'dark' ? '#131318' : '#f7f9fc';
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', themeColor);
  }

  private readMode(): ColorMode {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    if (typeof window.matchMedia !== 'function') {
      return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
