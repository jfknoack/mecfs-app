import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, UserRole } from './auth';

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.whenReady();
  return auth.isLoggedIn() ? router.createUrlTree(['/dashboard']) : true;
};

export const roleGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const requiredRole = route.data['role'] as UserRole | undefined;

  await auth.whenReady();

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (route.data['pacing'] && !auth.canSeePacing()) {
    return router.createUrlTree(['/dashboard']);
  }

  if (route.data['recipes'] && !auth.canSeeRecipes()) {
    return router.createUrlTree(['/dashboard']);
  }

  if (route.data['household'] && !auth.canSeeHousehold()) {
    return router.createUrlTree(['/dashboard']);
  }

  if (requiredRole === 'admin' && !auth.canManageUsers()) {
    return router.createUrlTree(['/dashboard']);
  }

  if (requiredRole && requiredRole !== 'admin' && auth.role() !== requiredRole) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
