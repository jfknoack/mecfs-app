import { computed, Injectable, isDevMode, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from '../firebase/firebase-app';
import { normalizeEmail, parseUserRole, isStaffRole, UserRole } from './auth.model';

export type { UserRole } from './auth.model';

const LEGACY_ROLE_KEY = 'mecfs.role';
const LEGACY_USERNAME_KEY = 'mecfs.username';
const DEV_UI_ROLE_KEY = 'mecfs.devUiRole';
const CALENDAR_TOKEN_KEY = 'mecfs.googleCalendarToken';
const CALENDAR_TOKEN_EXP_KEY = 'mecfs.googleCalendarTokenExp';
const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export class NotAllowedError extends Error {
  constructor() {
    super('Dieser Google-Account ist nicht freigeschaltet.');
    this.name = 'NotAllowedError';
  }
}

export class UnverifiedEmailError extends Error {
  constructor() {
    super('Die Google-E-Mail-Adresse ist nicht verifiziert.');
    this.name = 'UnverifiedEmailError';
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly dbRoleState = signal<UserRole | null>(null);
  private readonly uiRoleOverrideState = signal<UserRole | null>(readDevUiRole());
  private readonly usernameState = signal<string | null>(null);
  private readonly firebaseUserState = signal<User | null>(null);
  private readonly readyState = signal(false);
  private readonly emailState = signal<string | null>(null);
  private readonly calendarTokenState = signal<string | null>(readCalendarToken());
  private readonly calendarTokenExpState = signal<number>(readCalendarTokenExp());

  private resolveReady: () => void = () => undefined;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  private hydrateSeq = 0;

  readonly ready = this.readyState.asReadonly();
  readonly username = this.usernameState.asReadonly();
  readonly email = this.emailState.asReadonly();
  readonly uid = computed(() => this.firebaseUserState()?.uid ?? null);
  readonly actualRole = this.dbRoleState.asReadonly();
  readonly role = computed(() => {
    const dbRole = this.dbRoleState();
    const override = this.uiRoleOverrideState();
    if (isDevMode() && dbRole === 'admin' && override) {
      return override;
    }
    return dbRole;
  });
  readonly isLoggedIn = computed(() => this.dbRoleState() !== null);
  readonly isAdmin = computed(() => isStaffRole(this.role()));
  readonly actualIsAdmin = computed(() => isStaffRole(this.dbRoleState()));
  readonly isPatient = computed(() => this.role() === 'patient');
  readonly canSeePacing = computed(() => {
    const role = this.role();
    if (role === 'patient') {
      return true;
    }
    return role === 'admin' && this.isPacingSuperuser();
  });
  readonly canPreviewUiRole = computed(
    () => isDevMode() && this.dbRoleState() === 'admin' && this.isLoggedIn(),
  );
  readonly uiRolePreviewActive = computed(
    () => this.canPreviewUiRole() && this.role() !== this.dbRoleState(),
  );
  readonly hasCalendarAccess = computed(
    () => !!this.calendarTokenState() && Date.now() < this.calendarTokenExpState(),
  );

  constructor() {
    clearLegacySession();

    if (!isFirebaseConfigured()) {
      this.markReady();
      return;
    }

    onAuthStateChanged(firebaseAuth(), (user) => {
      void this.hydrate(user)
        .catch(() => undefined)
        .finally(() => this.markReady());
    });
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  async loginWithGoogle(): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase ist nicht konfiguriert.');
    }

    const auth = firebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    await this.hydrate(result.user);
  }

  async ensureUserDoc(): Promise<void> {
    const user = this.firebaseUserState();
    if (user) {
      await this.hydrate(user);
    }
  }

  setUiRole(role: UserRole): void {
    if (!isDevMode() || this.dbRoleState() !== 'admin') {
      return;
    }

    this.uiRoleOverrideState.set(role);
    sessionStorage.setItem(DEV_UI_ROLE_KEY, role);
  }

  async ensureCalendarAccess(): Promise<string> {
    const current = this.calendarTokenState();
    if (current && Date.now() < this.calendarTokenExpState()) {
      return current;
    }

    if (!isFirebaseConfigured()) {
      throw new Error('Firebase ist nicht konfiguriert.');
    }

    const provider = new GoogleAuthProvider();
    provider.addScope(CALENDAR_EVENTS_SCOPE);
    const email = this.email();
    provider.setCustomParameters(
      email
        ? { login_hint: email, include_granted_scopes: 'true' }
        : { include_granted_scopes: 'true' },
    );

    const result = await signInWithPopup(firebaseAuth(), provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken?.trim();
    if (!token) {
      throw new Error('Google hat keinen Kalender-Zugriff erteilt. Bitte den Kalender-Scope erlauben.');
    }

    this.storeCalendarToken(token, Date.now() + 50 * 60 * 1000);
    await this.hydrate(result.user);
    return token;
  }

  clearCalendarToken(): void {
    sessionStorage.removeItem(CALENDAR_TOKEN_KEY);
    sessionStorage.removeItem(CALENDAR_TOKEN_EXP_KEY);
    this.calendarTokenState.set(null);
    this.calendarTokenExpState.set(0);
  }

  async logout(): Promise<void> {
    sessionStorage.removeItem(DEV_UI_ROLE_KEY);
    this.uiRoleOverrideState.set(null);
    this.clearCalendarToken();
    if (isFirebaseConfigured()) {
      await signOut(firebaseAuth());
    }
    this.clearSession();
  }

  isPacingSuperuser(): boolean {
    return normalizeEmail(this.emailState() ?? '') === normalizeEmail(environment.bootstrapAdminEmail);
  }

  private async hydrate(user: User | null): Promise<void> {
    const seq = ++this.hydrateSeq;

    if (!user) {
      this.clearSession();
      return;
    }

    const email = user.email ? normalizeEmail(user.email) : '';
    if (!email) {
      await this.rejectSession();
      throw new NotAllowedError();
    }

    if (!user.emailVerified) {
      await this.rejectSession();
      throw new UnverifiedEmailError();
    }

    const bootstrap = normalizeEmail(environment.bootstrapAdminEmail);
    let role: UserRole;
    let name = displayNameOf(user);

    if (email === bootstrap) {
      role = 'admin';
    } else {
      const invite = await getDoc(doc(firebaseDb(), 'allowedUsers', email));
      if (!invite.exists()) {
        await this.rejectSession();
        throw new NotAllowedError();
      }

      const data = invite.data();
      const inviteRole = parseUserRole(data['role']);
      if (inviteRole !== 'user' && inviteRole !== 'admin' && inviteRole !== 'patient') {
        await this.rejectSession();
        throw new NotAllowedError();
      }

      role = inviteRole;
      const inviteName = String(data['name'] ?? '').trim();
      if (inviteName) {
        name = inviteName.slice(0, 80);
      }
    }

    try {
      await setDoc(
        doc(firebaseDb(), 'users', user.uid),
        {
          uid: user.uid,
          email,
          name,
          role,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (email === bootstrap) {
        await setDoc(
          doc(firebaseDb(), 'allowedUsers', email),
          {
            email,
            name,
            role: 'admin',
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    } catch (error) {
      await this.rejectSession();
      throw error;
    }

    if (seq !== this.hydrateSeq) {
      return;
    }

    this.firebaseUserState.set(user);
    this.dbRoleState.set(role);
    this.usernameState.set(name);
    this.emailState.set(email);
  }

  private async rejectSession(): Promise<void> {
    this.clearSession();
    if (isFirebaseConfigured()) {
      await signOut(firebaseAuth());
    }
  }

  private clearSession(): void {
    this.firebaseUserState.set(null);
    this.dbRoleState.set(null);
    this.usernameState.set(null);
    this.emailState.set(null);
    this.clearCalendarToken();
  }

  private storeCalendarToken(token: string, expiresAt: number): void {
    sessionStorage.setItem(CALENDAR_TOKEN_KEY, token);
    sessionStorage.setItem(CALENDAR_TOKEN_EXP_KEY, String(expiresAt));
    this.calendarTokenState.set(token);
    this.calendarTokenExpState.set(expiresAt);
  }

  private markReady(): void {
    if (this.readyState()) {
      return;
    }
    this.readyState.set(true);
    this.resolveReady();
  }
}

function displayNameOf(user: User): string {
  const name = user.displayName?.trim() || user.email?.trim() || 'Google User';
  return name.slice(0, 80);
}

function readDevUiRole(): UserRole | null {
  if (!isDevMode()) {
    return null;
  }
  const value = sessionStorage.getItem(DEV_UI_ROLE_KEY);
  return value === 'user' || value === 'admin' || value === 'patient' ? value : null;
}

function readCalendarToken(): string | null {
  return sessionStorage.getItem(CALENDAR_TOKEN_KEY);
}

function readCalendarTokenExp(): number {
  const value = Number(sessionStorage.getItem(CALENDAR_TOKEN_EXP_KEY));
  return Number.isFinite(value) ? value : 0;
}

function clearLegacySession(): void {
  localStorage.removeItem(LEGACY_ROLE_KEY);
  localStorage.removeItem(LEGACY_USERNAME_KEY);
}
