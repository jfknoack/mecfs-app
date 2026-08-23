import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/auth/role-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [roleGuard],
    data: { title: 'Dashboard' },
  },
  {
    path: 'listen',
    loadComponent: () => import('./pages/listen/listen').then((m) => m.Listen),
    canActivate: [roleGuard],
    data: { title: 'Listen' },
  },
  {
    path: 'listen/:id',
    loadComponent: () =>
      import('./pages/listen/listen-detail/listen-detail').then((m) => m.ListenDetail),
    canActivate: [roleGuard],
    data: { title: 'Liste' },
  },
  {
    path: 'routinen',
    loadComponent: () => import('./pages/routinen/routinen').then((m) => m.Routinen),
    canActivate: [roleGuard],
    data: { title: 'Routinen' },
  },
  {
    path: 'routinen/:id',
    loadComponent: () =>
      import('./pages/routinen/routine-detail/routine-detail').then((m) => m.RoutineDetail),
    canActivate: [roleGuard],
    data: { title: 'Routine' },
  },
  {
    path: 'rezepte',
    loadComponent: () => import('./pages/rezepte/rezepte').then((m) => m.Rezepte),
    canActivate: [roleGuard],
    data: { title: 'Rezepte' },
  },
  {
    path: 'rezepte/:id',
    loadComponent: () =>
      import('./pages/rezepte/rezept-detail/rezept-detail').then((m) => m.RezeptDetail),
    canActivate: [roleGuard],
    data: { title: 'Rezept' },
  },
  {
    path: 'budget',
    loadComponent: () => import('./pages/budget/budget').then((m) => m.Budget),
    canActivate: [roleGuard],
    data: { title: 'Budget' },
  },
  {
    path: 'budget/:year/:month',
    loadComponent: () =>
      import('./pages/budget/budget-month/budget-month').then((m) => m.BudgetMonth),
    canActivate: [roleGuard],
    data: { title: 'Budget Monat' },
  },
  {
    path: 'kalender',
    loadComponent: () => import('./pages/kalender/kalender').then((m) => m.Kalender),
    canActivate: [roleGuard],
    data: { title: 'Kalender' },
  },
  {
    path: 'pacing',
    loadComponent: () => import('./pages/pacing/pacing').then((m) => m.Pacing),
    canActivate: [roleGuard],
    data: { title: 'Pacing', pacing: true },
  },
  {
    path: 'pacing/aktivitaeten',
    loadComponent: () =>
      import('./pages/pacing/pacing-aktivitaeten/pacing-aktivitaeten').then(
        (m) => m.PacingAktivitaeten,
      ),
    canActivate: [roleGuard],
    data: { title: 'Aktivitäten', pacing: true },
  },
  {
    path: 'pacing/kategorien',
    redirectTo: '/pacing/aktivitaeten',
    pathMatch: 'full',
  },
  {
    path: 'pacing/kategorien/:id',
    redirectTo: '/pacing/aktivitaeten',
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    canActivate: [roleGuard],
    data: { title: 'Admin', role: 'admin' },
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
