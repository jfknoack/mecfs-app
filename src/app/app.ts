import { NgClass } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { Auth, UserRole } from './core/auth/auth';
import { AppUpdate } from './core/pwa/app-update';
import { Theme } from './core/theme/theme';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  pacingOnly?: boolean;
}

@Component({
  imports: [
    NgClass,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  protected readonly auth = inject(Auth);
  protected readonly appUpdate = inject(AppUpdate);
  protected readonly theme = inject(Theme);
  protected readonly sidenav = viewChild<MatSidenav>('sidenav');

  protected readonly isHandset = toSignal(
    this.breakpointObserver.observe([Breakpoints.Handset]).pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  private readonly allNavItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'house' },
    { path: '/listen', label: 'Listen', icon: 'list' },
    { path: '/routinen', label: 'Routinen', icon: 'repeat' },
    { path: '/rezepte', label: 'Rezepte', icon: 'utensils' },
    { path: '/budget', label: 'Budget', icon: 'wallet' },
    { path: '/kalender', label: 'Kalender', icon: 'calendar-days' },
    { path: '/pacing', label: 'Pacing', icon: 'battery-half', pacingOnly: true },
    { path: '/admin', label: 'Admin', icon: 'user-shield', adminOnly: true },
  ];

  protected readonly navItems = computed(() =>
    this.allNavItems.filter((item) => {
      if (item.adminOnly && !this.auth.isAdmin()) {
        return false;
      }
      if (item.pacingOnly && !this.auth.canSeePacing()) {
        return false;
      }
      return true;
    }),
  );

  protected async onNavClick(): Promise<void> {
    if (this.isHandset()) {
      await this.sidenav()?.close();
    }
  }

  protected setUiRole(role: UserRole): void {
    this.auth.setUiRole(role);
    if (!this.auth.isAdmin() && this.router.url.startsWith('/admin')) {
      void this.router.navigateByUrl('/dashboard');
    }
    if (!this.auth.canSeePacing() && this.router.url.startsWith('/pacing')) {
      void this.router.navigateByUrl('/dashboard');
    }
  }

  protected logout(): void {
    void this.auth.logout().then(() => this.router.navigateByUrl('/login'));
  }
}
