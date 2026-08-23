import { effect, Injectable, signal, untracked } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/auth';
import { AllowedUser, normalizeEmail, parseUserRole, UserRole } from '../auth/auth.model';
import { firebaseDb, isFirebaseConfigured } from '../firebase/firebase-app';

export class DuplicateAllowedUserError extends Error {
  constructor(email: string) {
    super(`„${email}" ist bereits angelegt.`);
    this.name = 'DuplicateAllowedUserError';
  }
}

export class BootstrapUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootstrapUserError';
  }
}

@Injectable({ providedIn: 'root' })
export class AllowedUserService {
  private readonly usersState = signal<AllowedUser[]>([]);
  private readonly readyState = signal(false);
  private unsub: Unsubscribe | null = null;

  readonly users = this.usersState.asReadonly();
  readonly ready = this.readyState.asReadonly();

  constructor(private readonly auth: Auth) {
    effect(() => {
      const uid = this.auth.uid();
      const isAdmin = this.auth.actualIsAdmin();
      untracked(() => {
        if (!isFirebaseConfigured() || !uid || !isAdmin) {
          this.stopWatching();
          this.usersState.set([]);
          this.readyState.set(!uid || !isAdmin);
          return;
        }
        this.watchUsers();
      });
    });
  }

  async createUser(input: { name: string; email: string; role: UserRole }): Promise<void> {
    this.requireAdmin();
    const email = normalizeEmail(input.email);
    const name = input.name.trim().slice(0, 80);
    if (!email || !name) {
      throw new Error('Name und E-Mail sind erforderlich.');
    }

    const ref = doc(firebaseDb(), 'allowedUsers', email);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      throw new DuplicateAllowedUserError(email);
    }

    await setDoc(ref, {
      email,
      name,
      role: input.role,
      createdAt: serverTimestamp(),
      createdByUid: this.auth.uid(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateUser(email: string, patch: { name?: string; role?: UserRole }): Promise<void> {
    this.requireAdmin();
    const emailId = normalizeEmail(email);
    this.guardBootstrap(emailId, patch.role);

    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) {
      payload['name'] = patch.name.trim().slice(0, 80);
    }
    if (patch.role !== undefined) {
      payload['role'] = patch.role;
    }

    await updateDoc(doc(firebaseDb(), 'allowedUsers', emailId), payload);
    await this.syncLinkedUserDocs(emailId, payload);
  }

  async deleteUser(email: string): Promise<void> {
    this.requireAdmin();
    const emailId = normalizeEmail(email);
    if (emailId === normalizeEmail(environment.bootstrapAdminEmail)) {
      throw new BootstrapUserError('Der Bootstrap-Admin kann nicht entfernt werden.');
    }

    await deleteDoc(doc(firebaseDb(), 'allowedUsers', emailId));

    const snapshots = await getDocs(
      query(collection(firebaseDb(), 'users'), where('email', '==', emailId)),
    );
    await Promise.all(snapshots.docs.map((item) => deleteDoc(item.ref)));
  }

  isBootstrap(email: string): boolean {
    return normalizeEmail(email) === normalizeEmail(environment.bootstrapAdminEmail);
  }

  private watchUsers(): void {
    this.stopWatching();
    this.unsub = onSnapshot(
      collection(firebaseDb(), 'allowedUsers'),
      (snapshot) => {
        this.usersState.set(
          snapshot.docs
            .map(toAllowedUser)
            .sort((a, b) => a.name.localeCompare(b.name, 'de')),
        );
        this.readyState.set(true);
      },
      () => {
        this.usersState.set([]);
        this.readyState.set(true);
      },
    );
  }

  private stopWatching(): void {
    this.unsub?.();
    this.unsub = null;
  }

  private async syncLinkedUserDocs(
    email: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const snapshots = await getDocs(
      query(collection(firebaseDb(), 'users'), where('email', '==', email)),
    );
    const next: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (typeof payload['name'] === 'string') {
      next['name'] = payload['name'];
    }
    if (payload['role'] === 'user' || payload['role'] === 'admin' || payload['role'] === 'patient') {
      next['role'] = payload['role'];
    }
    await Promise.all(snapshots.docs.map((item) => updateDoc(item.ref, next)));
  }

  private guardBootstrap(email: string, role?: UserRole): void {
    if (!this.isBootstrap(email)) {
      return;
    }
    if (role && role !== 'admin') {
      throw new BootstrapUserError('Der Bootstrap-Admin muss Admin bleiben.');
    }
  }

  private requireAdmin(): void {
    if (!this.auth.uid() || !this.auth.actualIsAdmin()) {
      throw new Error('Nur Admins können Benutzer verwalten.');
    }
  }
}

function toAllowedUser(snapshot: QueryDocumentSnapshot<DocumentData>): AllowedUser {
  const data = snapshot.data();
  const role = parseUserRole(data['role']);
  return {
    email: normalizeEmail(String(data['email'] ?? snapshot.id)),
    name: String(data['name'] ?? '').trim() || snapshot.id,
    role,
  };
}
