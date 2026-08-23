import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, NotAllowedError, UnverifiedEmailError } from '../../core/auth/auth';
import { Theme } from '../../core/theme/theme';

@Component({
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly theme = inject(Theme);

  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected async login(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);

    try {
      await this.auth.loginWithGoogle();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/dashboard');
    } catch (error) {
      this.error.set(loginErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof NotAllowedError || error instanceof UnverifiedEmailError) {
    return error.message;
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: string }).code)
      : '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google-Login wurde abgebrochen.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google-Anmeldung ist in Firebase noch nicht aktiviert.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Diese Domain ist in Firebase nicht für Google-Login zugelassen.';
  }
  if (code === 'permission-denied') {
    return 'Kein Zugriff. Der Account ist nicht freigeschaltet oder die Regeln sind noch nicht veröffentlicht.';
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/configuration-not-found') {
    return 'Firebase ist noch nicht vollständig eingerichtet.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Google-Login fehlgeschlagen.';
}
