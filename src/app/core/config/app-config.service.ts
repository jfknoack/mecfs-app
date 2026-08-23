import { computed, Injectable, signal } from '@angular/core';
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { normalizeEmail } from '../auth/auth.model';
import { firebaseDb, isFirebaseConfigured } from '../firebase/firebase-app';

const CONFIG_COLLECTION = 'config';
const CONFIG_DOC = 'app';

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly bootstrapAdminEmailState = signal('');
  private readonly googleCalendarIdState = signal('');
  private unsub: Unsubscribe | null = null;

  readonly bootstrapAdminEmail = this.bootstrapAdminEmailState.asReadonly();
  readonly googleCalendarId = this.googleCalendarIdState.asReadonly();
  readonly calendarConfigured = computed(() => Boolean(this.googleCalendarId().trim()));

  isBootstrap(email: string): boolean {
    const bootstrap = this.bootstrapAdminEmail();
    return Boolean(bootstrap) && normalizeEmail(email) === bootstrap;
  }

  async refresh(): Promise<void> {
    if (!isFirebaseConfigured()) {
      this.clear();
      return;
    }
    const snapshot = await getDoc(doc(firebaseDb(), CONFIG_COLLECTION, CONFIG_DOC));
    this.apply(snapshot.data());
  }

  startWatching(): void {
    if (!isFirebaseConfigured() || this.unsub) {
      return;
    }
    this.unsub = onSnapshot(
      doc(firebaseDb(), CONFIG_COLLECTION, CONFIG_DOC),
      (snapshot) => this.apply(snapshot.data()),
      () => this.clear(),
    );
  }

  stopWatching(): void {
    this.unsub?.();
    this.unsub = null;
  }

  clear(): void {
    this.bootstrapAdminEmailState.set('');
    this.googleCalendarIdState.set('');
  }

  private apply(data: Record<string, unknown> | undefined): void {
    this.bootstrapAdminEmailState.set(normalizeEmail(String(data?.['bootstrapAdminEmail'] ?? '')));
    this.googleCalendarIdState.set(String(data?.['googleCalendarId'] ?? '').trim());
  }
}
