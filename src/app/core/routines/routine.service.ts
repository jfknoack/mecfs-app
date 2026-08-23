import { effect, Injectable, signal, untracked } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { Auth } from '../auth/auth';
import { firebaseDb, isFirebaseConfigured } from '../firebase/firebase-app';
import {
  CreateRoutineInput,
  isDateKey,
  isTimeValue,
  newRoutineItemId,
  normalizeRoutineColor,
  Routine,
  RoutineItem,
  RoutineItemKind,
  RoutineRecurrence,
  UpdateRoutineInput,
} from './routine.model';

@Injectable({ providedIn: 'root' })
export class RoutineService {
  private readonly routinesState = signal<Routine[]>([]);
  private readonly routineState = signal<Routine | null>(null);
  private readonly routinesReadyState = signal(false);
  private readonly routineReadyState = signal(false);
  private routinesUnsub: Unsubscribe | null = null;
  private routineUnsub: Unsubscribe | null = null;

  readonly routines = this.routinesState.asReadonly();
  readonly routinesReady = this.routinesReadyState.asReadonly();
  readonly routine = this.routineState.asReadonly();
  readonly routineReady = this.routineReadyState.asReadonly();

  constructor(private readonly auth: Auth) {
    effect(() => {
      const uid = this.auth.uid();
      const canSee = this.auth.canSeeHousehold();
      untracked(() => {
        if (!isFirebaseConfigured() || !uid || !canSee) {
          this.stopWatchingRoutines();
          this.routinesState.set([]);
          this.routinesReadyState.set(true);
          return;
        }
        this.watchRoutines();
      });
    });
  }

  watchRoutines(): void {
    this.stopWatchingRoutines();
    if (!isFirebaseConfigured() || !this.auth.uid()) {
      this.routinesState.set([]);
      this.routinesReadyState.set(true);
      return;
    }

    this.routinesUnsub = onSnapshot(
      collection(firebaseDb(), 'routines'),
      (snapshot) => {
        this.routinesState.set(
          [...toRoutineMap(snapshot.docs).values()].sort((a, b) =>
            a.title.localeCompare(b.title, 'de'),
          ),
        );
        this.routinesReadyState.set(true);
      },
      () => this.routinesReadyState.set(true),
    );
  }

  stopWatchingRoutines(): void {
    this.routinesUnsub?.();
    this.routinesUnsub = null;
  }

  watchRoutine(id: string): void {
    this.stopWatchingRoutine();
    if (!isFirebaseConfigured() || !id) {
      this.routineReadyState.set(true);
      return;
    }

    this.routineUnsub = onSnapshot(
      doc(firebaseDb(), 'routines', id),
      (snapshot) => {
        this.routineState.set(snapshot.exists() ? toRoutine(snapshot) : null);
        this.routineReadyState.set(true);
      },
      () => {
        this.routineState.set(null);
        this.routineReadyState.set(true);
      },
    );
  }

  stopWatchingRoutine(): void {
    this.routineUnsub?.();
    this.routineUnsub = null;
    this.routineState.set(null);
    this.routineReadyState.set(false);
  }

  canEdit(): boolean {
    return this.auth.canManageHousehold();
  }

  async createRoutine(input: CreateRoutineInput): Promise<string> {
    const uid = this.requireAdmin();
    const data = normalizeRoutineInput(input);
    const routineRef = doc(collection(firebaseDb(), 'routines'));
    await setDoc(routineRef, {
      ...data,
      authorUid: uid,
      authorName: this.auth.username() ?? 'Unbekannt',
      items: [],
      completions: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return routineRef.id;
  }

  async updateRoutine(routine: Routine, input: UpdateRoutineInput): Promise<void> {
    this.requireAdmin();
    const data = normalizeRoutineInput(input);
    await updateDoc(doc(firebaseDb(), 'routines', routine.id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async addListItem(
    routine: Routine,
    listId: string,
    listName: string,
    entryId: string,
    text: string,
  ): Promise<void> {
    await this.addItems(routine, [
      {
        id: newRoutineItemId(),
        kind: 'listEntry',
        listId,
        listName,
        entryId,
        recipeId: '',
        text,
      },
    ]);
  }

  async addRecipeItem(routine: Routine, recipeId: string, title: string): Promise<void> {
    await this.addItems(routine, [
      {
        id: newRoutineItemId(),
        kind: 'recipe',
        listId: '',
        listName: '',
        entryId: '',
        recipeId,
        text: title,
      },
    ]);
  }

  async addItems(routine: Routine, items: RoutineItem[]): Promise<void> {
    this.requireAdmin();
    if (!items.length) {
      throw new Error('Bitte mindestens einen Punkt hinzufügen.');
    }
    const current = this.currentRoutine(routine);
    const next = [...current.items];
    for (const item of items) {
      const duplicate =
        item.kind === 'recipe'
          ? next.some((entry) => entry.kind === 'recipe' && entry.recipeId === item.recipeId)
          : next.some((entry) => entry.kind === 'listEntry' && entry.entryId === item.entryId);
      if (duplicate) {
        throw new Error(
          item.kind === 'recipe'
            ? 'Dieses Rezept ist bereits in der Routine.'
            : 'Dieser Listeneintrag ist bereits in der Routine.',
        );
      }
      next.push({
        ...item,
        id: item.id || newRoutineItemId(),
      });
    }
    await this.writeItems(current, next);
  }

  async deleteItem(routine: Routine, itemId: string): Promise<void> {
    this.requireAdmin();
    const current = this.currentRoutine(routine);
    await this.writeItems(
      current,
      current.items.filter((item) => item.id !== itemId),
    );
  }

  async setItemChecked(routine: Routine, dateKey: string, itemId: string, checked: boolean): Promise<void> {
    this.requireUid();
    if (!isDateKey(dateKey)) {
      throw new Error('Ungültiges Datum.');
    }
    const current = this.currentRoutine(routine);
    if (!current.items.some((item) => item.id === itemId)) {
      return;
    }

    const day = { ...(current.completions[dateKey] ?? {}) };
    if (checked) {
      day[itemId] = true;
    } else {
      delete day[itemId];
    }

    const completions = { ...current.completions };
    if (Object.keys(day).length) {
      completions[dateKey] = day;
    } else {
      delete completions[dateKey];
    }

    this.routineState.set({ ...current, completions });
    try {
      await updateDoc(doc(firebaseDb(), 'routines', routine.id), {
        completions,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const live = this.currentRoutine(routine);
      if (live.id === routine.id) {
        this.routineState.set({ ...live, completions: current.completions });
      }
      throw error;
    }
  }

  async deleteRoutine(routine: Routine): Promise<void> {
    this.requireAdmin();
    await deleteDoc(doc(firebaseDb(), 'routines', routine.id));
  }

  private async writeItems(routine: Routine, items: RoutineItem[]): Promise<void> {
    await updateDoc(doc(firebaseDb(), 'routines', routine.id), {
      items: items.map(toStoredItem),
      updatedAt: serverTimestamp(),
    });
  }

  private currentRoutine(routine: Routine): Routine {
    const live = this.routineState();
    return live?.id === routine.id ? live : routine;
  }

  private requireUid(): string {
    const uid = this.auth.uid();
    if (!uid) {
      throw new Error('Bitte erneut anmelden, um Routinen zu speichern.');
    }
    return uid;
  }

  private requireAdmin(): string {
    const uid = this.requireUid();
    if (!this.auth.canManageHousehold()) {
      throw new Error('Routinen können so nicht gespeichert werden.');
    }
    return uid;
  }
}

function normalizeRoutineInput(input: CreateRoutineInput): {
  title: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  recurrence: RoutineRecurrence;
  weekdays: number[];
  visibility: 'public' | 'private';
  color: ReturnType<typeof normalizeRoutineColor>;
} {
  const title = input.title.trim().replace(/\s+/g, ' ');
  if (!title || title.length > 80) {
    throw new Error('Bitte einen gültigen Titel angeben.');
  }
  if (!isDateKey(input.date)) {
    throw new Error('Bitte ein gültiges Datum angeben.');
  }
  if (!isTimeValue(input.timeFrom)) {
    throw new Error('Bitte eine gültige Startzeit angeben.');
  }
  const timeTo = input.timeTo.trim();
  if (timeTo && !isTimeValue(timeTo)) {
    throw new Error('Bitte eine gültige Endzeit angeben.');
  }
  if (timeTo && timeTo <= input.timeFrom) {
    throw new Error('Die Endzeit muss nach der Startzeit liegen.');
  }
  const recurrence = toRecurrence(input.recurrence);
  const weekdays =
    recurrence === 'weekly' ? normalizeWeekdays(input.weekdays) : [];
  if (recurrence === 'weekly' && !weekdays.length) {
    throw new Error('Bitte mindestens einen Wochentag wählen.');
  }
  return {
    title,
    date: input.date,
    timeFrom: input.timeFrom,
    timeTo,
    recurrence,
    weekdays,
    visibility: input.visibility === 'public' ? 'public' : 'private',
    color: normalizeRoutineColor(input.color),
  };
}

function toRecurrence(value: string): RoutineRecurrence {
  if (value === 'daily' || value === 'weekly' || value === 'once') {
    return value;
  }
  return 'once';
}

function normalizeWeekdays(values: number[]): number[] {
  return [...new Set(values.filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b);
}

function toRoutineMap(docs: QueryDocumentSnapshot<DocumentData>[]): Map<string, Routine> {
  return new Map(docs.map((item) => [item.id, toRoutine(item)]));
}

function toRoutine(snapshot: { id: string; data: () => DocumentData | undefined }): Routine {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    title: String(data['title'] ?? ''),
    date: String(data['date'] ?? ''),
    timeFrom: String(data['timeFrom'] ?? '08:00'),
    timeTo: String(data['timeTo'] ?? ''),
    recurrence: toRecurrence(String(data['recurrence'] ?? 'once')),
    weekdays: normalizeWeekdays(Array.isArray(data['weekdays']) ? data['weekdays'].map(Number) : []),
    visibility: data['visibility'] === 'public' ? 'public' : 'private',
    color: normalizeRoutineColor(data['color']),
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    items: toItems(data['items']),
    completions: toCompletions(data['completions']),
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

function toItems(value: unknown): RoutineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const item = entry as Record<string, unknown>;
      const kind: RoutineItemKind = item['kind'] === 'recipe' ? 'recipe' : 'listEntry';
      const text = String(item['text'] ?? '').trim();
      if (!text) {
        return null;
      }
      return {
        id: String(item['id'] ?? newRoutineItemId()),
        kind,
        listId: String(item['listId'] ?? ''),
        listName: String(item['listName'] ?? ''),
        entryId: String(item['entryId'] ?? ''),
        recipeId: String(item['recipeId'] ?? ''),
        text,
      };
    })
    .filter((item): item is RoutineItem => item !== null);
}

function toStoredItem(item: RoutineItem): RoutineItem {
  return {
    id: item.id,
    kind: item.kind,
    listId: item.listId,
    listName: item.listName,
    entryId: item.entryId,
    recipeId: item.recipeId,
    text: item.text,
  };
}

function toCompletions(value: unknown): Record<string, Record<string, boolean>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, Record<string, boolean>> = {};
  for (const [dateKey, day] of Object.entries(value as Record<string, unknown>)) {
    if (!isDateKey(dateKey) || !day || typeof day !== 'object' || Array.isArray(day)) {
      continue;
    }
    const checks: Record<string, boolean> = {};
    for (const [itemId, checked] of Object.entries(day as Record<string, unknown>)) {
      if (checked === true) {
        checks[itemId] = true;
      }
    }
    if (Object.keys(checks).length) {
      result[dateKey] = checks;
    }
  }
  return result;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}
