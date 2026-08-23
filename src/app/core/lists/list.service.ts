import { effect, Injectable, signal, untracked } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { Auth } from '../auth/auth';
import { firebaseDb, isFirebaseConfigured } from '../firebase/firebase-app';
import { AppList, CreateListInput, ListEntry, UpdateListInput } from './list.model';

export class DuplicateListNameError extends Error {
  constructor(name: string) {
    super(`Listentyp "${name}" existiert bereits.`);
    this.name = 'DuplicateListNameError';
  }
}

@Injectable({ providedIn: 'root' })
export class ListService {
  private readonly listsState = signal<AppList[]>([]);
  private readonly entriesState = signal<ListEntry[]>([]);
  private listsUnsubs: Unsubscribe[] = [];
  private entriesUnsub: Unsubscribe | null = null;

  private readonly listsReadyState = signal(false);

  readonly lists = this.listsState.asReadonly();
  readonly listsReady = this.listsReadyState.asReadonly();
  readonly entries = this.entriesState.asReadonly();

  constructor(private readonly auth: Auth) {
    effect(() => {
      const uid = this.auth.uid();
      untracked(() => {
        if (!isFirebaseConfigured()) {
          this.stopWatchingLists();
          this.listsState.set([]);
          this.listsReadyState.set(true);
          return;
        }
        if (uid) {
          this.watchLists();
        } else {
          this.stopWatchingLists();
          this.listsState.set([]);
          this.listsReadyState.set(false);
        }
      });
    });
  }

  watchLists(): void {
    this.stopWatchingLists();
    const uid = this.auth.uid();
    if (!uid) {
      this.listsState.set([]);
      return;
    }

    const listsRef = collection(firebaseDb(), 'lists');
    this.listsUnsubs = [
      onSnapshot(
        listsRef,
        (snapshot) => {
          this.listsState.set(
            [...toListMap(snapshot.docs).values()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
          );
          this.listsReadyState.set(true);
        },
        () => this.listsReadyState.set(true),
      ),
    ];
  }

  stopWatchingLists(): void {
    for (const unsub of this.listsUnsubs) {
      unsub();
    }
    this.listsUnsubs = [];
  }

  watchEntries(listId: string): void {
    this.stopWatchingEntries();
    if (!isFirebaseConfigured() || !listId) {
      return;
    }
    const entriesRef = collection(firebaseDb(), 'lists', listId, 'entries');
    this.entriesUnsub = onSnapshot(entriesRef, (snapshot) => {
      const entries = snapshot.docs
        .map((item) => toListEntry(listId, item))
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      this.entriesState.set(entries);
    });
  }

  stopWatchingEntries(): void {
    this.entriesUnsub?.();
    this.entriesUnsub = null;
    this.entriesState.set([]);
  }

  listById(id: string): AppList | undefined {
    return this.listsState().find((list) => list.id === id);
  }

  async loadEntries(listId: string): Promise<ListEntry[]> {
    if (!isFirebaseConfigured() || !listId) {
      return [];
    }
    const snapshot = await getDocs(collection(firebaseDb(), 'lists', listId, 'entries'));
    return snapshot.docs
      .map((item) => toListEntry(listId, item))
      .sort((a, b) => a.text.localeCompare(b.text, 'de'));
  }

  async createList(input: CreateListInput): Promise<string> {
    const uid = this.requireAdmin();
    const name = input.name.trim().replace(/\s+/g, ' ');
    const nameKey = toNameKey(name);
    if (!name || !nameKey) {
      throw new Error('Bitte einen Listennamen angeben.');
    }

    const listRef = doc(collection(firebaseDb(), 'lists'));
    const nameRef = doc(firebaseDb(), 'listNames', nameKey);

    await runTransaction(firebaseDb(), async (transaction) => {
      const existing = await transaction.get(nameRef);
      if (existing.exists()) {
        throw new DuplicateListNameError(name);
      }

      transaction.set(nameRef, {
        listId: listRef.id,
        authorUid: uid,
      });
      transaction.set(listRef, {
        name,
        nameKey,
        icon: input.icon,
        visibility: input.visibility,
        authorUid: uid,
        authorName: this.auth.username() ?? 'Unbekannt',
        entryCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return listRef.id;
  }

  async updateList(list: AppList, input: UpdateListInput): Promise<void> {
    const uid = this.requireAdmin();
    const name = input.name.trim().replace(/\s+/g, ' ');
    const nameKey = toNameKey(name);
    if (!name || !nameKey) {
      throw new Error('Bitte einen Listennamen angeben.');
    }

    const listRef = doc(firebaseDb(), 'lists', list.id);

    await runTransaction(firebaseDb(), async (transaction) => {
      if (nameKey !== list.nameKey) {
        const newNameRef = doc(firebaseDb(), 'listNames', nameKey);
        const existing = await transaction.get(newNameRef);
        if (existing.exists()) {
          throw new DuplicateListNameError(name);
        }
        transaction.delete(doc(firebaseDb(), 'listNames', list.nameKey));
        transaction.set(newNameRef, {
          listId: list.id,
          authorUid: uid,
        });
      }

      transaction.update(listRef, {
        name,
        nameKey,
        visibility: input.visibility,
        updatedAt: serverTimestamp(),
      });
    });
  }

  async deleteList(list: AppList): Promise<void> {
    this.requireAdmin();
    const entriesSnap = await getDocs(collection(firebaseDb(), 'lists', list.id, 'entries'));
    const batch = writeBatch(firebaseDb());
    for (const entry of entriesSnap.docs) {
      batch.delete(entry.ref);
    }
    batch.delete(doc(firebaseDb(), 'lists', list.id));
    batch.delete(doc(firebaseDb(), 'listNames', list.nameKey));
    await batch.commit();
  }

  async addEntry(list: AppList, text: string): Promise<void> {
    const uid = this.requireAdmin();
    const value = text.trim();
    if (!value) {
      throw new Error('Bitte einen Eintragstext angeben.');
    }

    await addDoc(collection(firebaseDb(), 'lists', list.id, 'entries'), {
      text: value,
      authorUid: uid,
      authorName: this.auth.username() ?? 'Unbekannt',
      createdAt: serverTimestamp(),
    });

    await runTransaction(firebaseDb(), async (transaction) => {
      const listRef = doc(firebaseDb(), 'lists', list.id);
      const snapshot = await transaction.get(listRef);
      const current = snapshot.data()?.['entryCount'];
      const entryCount = typeof current === 'number' ? current + 1 : 1;
      transaction.update(listRef, { entryCount, updatedAt: serverTimestamp() });
    });
  }

  async updateEntry(list: AppList, entry: ListEntry, text: string): Promise<void> {
    this.requireAdmin();
    const value = text.trim();
    if (!value || value.length > 500) {
      throw new Error('Bitte einen gültigen Eintragstext angeben.');
    }

    await updateDoc(doc(firebaseDb(), 'lists', list.id, 'entries', entry.id), {
      text: value,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteEntry(list: AppList, entry: ListEntry): Promise<void> {
    this.requireAdmin();

    await deleteDoc(doc(firebaseDb(), 'lists', list.id, 'entries', entry.id));
    await runTransaction(firebaseDb(), async (transaction) => {
      const listRef = doc(firebaseDb(), 'lists', list.id);
      const snapshot = await transaction.get(listRef);
      const current = snapshot.data()?.['entryCount'];
      const entryCount = typeof current === 'number' && current > 0 ? current - 1 : 0;
      transaction.update(listRef, { entryCount, updatedAt: serverTimestamp() });
    });
  }

  private requireUid(): string {
    const uid = this.auth.uid();
    if (!uid) {
      throw new Error('Bitte erneut anmelden, um Listen zu speichern.');
    }
    return uid;
  }

  private requireAdmin(): string {
    const uid = this.requireUid();
    if (!this.auth.isAdmin()) {
      throw new Error('Nur Admins können Listen pflegen.');
    }
    return uid;
  }
}

export function toNameKey(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('de-DE')
    .replaceAll('/', '-')
    .replaceAll('.', '-');
}

function toListMap(docs: QueryDocumentSnapshot<DocumentData>[]): Map<string, AppList> {
  return new Map(docs.map((item) => [item.id, toAppList(item)]));
}

function toAppList(snapshot: QueryDocumentSnapshot<DocumentData>): AppList {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: String(data['name'] ?? ''),
    nameKey: String(data['nameKey'] ?? ''),
    icon: String(data['icon'] ?? 'list'),
    visibility: data['visibility'] === 'public' ? 'public' : 'private',
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    entryCount: typeof data['entryCount'] === 'number' ? data['entryCount'] : 0,
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

function toListEntry(listId: string, snapshot: QueryDocumentSnapshot<DocumentData>): ListEntry {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    listId,
    text: String(data['text'] ?? ''),
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    createdAt: toDate(data['createdAt']),
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}
