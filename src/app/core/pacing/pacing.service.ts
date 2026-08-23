import { effect, Injectable, signal, untracked } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
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
import { toNameKey } from '../lists/list.service';
import {
  clampBudget,
  clampDifficulty,
  comparePacingLogs,
  CreatePacingActivityInput,
  CreatePacingLogInput,
  isPacingLogToday,
  normalizePacingKind,
  normalizePacingTime,
  nowTimeKey,
  PACING_BUDGET_DEFAULT,
  PacingActivity,
  PacingDay,
  PacingLog,
  SavePacingDayInput,
} from './pacing.model';

export class DuplicatePacingActivityError extends Error {
  constructor(title: string) {
    super(`Aktivität „${title}" existiert bereits.`);
    this.name = 'DuplicatePacingActivityError';
  }
}

export class SameDayPacingError extends Error {
  constructor() {
    super('Nur der heutige Tag kann geändert werden.');
    this.name = 'SameDayPacingError';
  }
}

@Injectable({ providedIn: 'root' })
export class PacingService {
  private readonly activitiesState = signal<PacingActivity[]>([]);
  private readonly logsState = signal<PacingLog[]>([]);
  private readonly daysState = signal<PacingDay[]>([]);
  private readonly activitiesReadyState = signal(false);
  private readonly logsReadyState = signal(false);
  private readonly daysReadyState = signal(false);
  private activitiesUnsub: Unsubscribe | null = null;
  private logsUnsub: Unsubscribe | null = null;
  private daysUnsub: Unsubscribe | null = null;

  readonly activities = this.activitiesState.asReadonly();
  readonly logs = this.logsState.asReadonly();
  readonly days = this.daysState.asReadonly();
  readonly activitiesReady = this.activitiesReadyState.asReadonly();
  readonly logsReady = this.logsReadyState.asReadonly();
  readonly daysReady = this.daysReadyState.asReadonly();

  constructor(private readonly auth: Auth) {
    effect(() => {
      const uid = this.auth.uid();
      const canSee = this.auth.canSeePacing();
      untracked(() => {
        if (!isFirebaseConfigured() || !uid || !canSee) {
          this.stopWatchingActivities();
          this.stopWatchingLogs();
          this.stopWatchingDays();
          this.activitiesState.set([]);
          this.logsState.set([]);
          this.daysState.set([]);
          this.activitiesReadyState.set(true);
          this.logsReadyState.set(true);
          this.daysReadyState.set(true);
          return;
        }
        this.watchActivities();
        this.watchLogs();
        this.watchDays();
      });
    });
  }

  activityById(id: string): PacingActivity | undefined {
    return this.activitiesState().find((activity) => activity.id === id);
  }

  logById(id: string): PacingLog | undefined {
    return this.logsState().find((log) => log.id === id);
  }

  dayByDate(date: string): PacingDay | undefined {
    return this.daysState().find((day) => day.date === date);
  }

  logsOnDate(date: string): PacingLog[] {
    return this.logsState()
      .filter((log) => log.date === date)
      .sort(comparePacingLogs);
  }

  lastBudget(): number {
    const latest = [...this.daysState()].sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest?.budget ?? PACING_BUDGET_DEFAULT;
  }

  budgetFor(date: string): number {
    return this.dayByDate(date)?.budget ?? this.lastBudget();
  }

  async createActivity(input: CreatePacingActivityInput): Promise<string> {
    const uid = this.requirePacingAccess();
    const title = input.title.trim().replace(/\s+/g, ' ');
    const titleKey = toNameKey(title);
    const description = input.description.trim();
    if (!title || !titleKey) {
      throw new Error('Bitte einen Titel angeben.');
    }

    const activityRef = doc(collection(firebaseDb(), 'pacingActivities'));
    const nameRef = doc(firebaseDb(), 'pacingActivityNames', titleKey);

    await runTransaction(firebaseDb(), async (transaction) => {
      const existing = await transaction.get(nameRef);
      if (existing.exists()) {
        throw new DuplicatePacingActivityError(title);
      }
      transaction.set(nameRef, {
        activityId: activityRef.id,
        authorUid: uid,
      });
      transaction.set(activityRef, {
        title,
        titleKey,
        description,
        kind: normalizePacingKind(input.kind),
        energyCost: clampDifficulty(input.energyCost),
        authorUid: uid,
        authorName: this.auth.username() ?? 'Unbekannt',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return activityRef.id;
  }

  async updateActivity(activity: PacingActivity, input: CreatePacingActivityInput): Promise<void> {
    const uid = this.requirePacingAccess();
    const title = input.title.trim().replace(/\s+/g, ' ');
    const titleKey = toNameKey(title);
    const description = input.description.trim();
    if (!title || !titleKey || title.length > 80) {
      throw new Error('Bitte einen gültigen Titel angeben.');
    }

    const activityRef = doc(firebaseDb(), 'pacingActivities', activity.id);
    await runTransaction(firebaseDb(), async (transaction) => {
      if (titleKey !== activity.titleKey) {
        const newNameRef = doc(firebaseDb(), 'pacingActivityNames', titleKey);
        const existing = await transaction.get(newNameRef);
        if (existing.exists()) {
          throw new DuplicatePacingActivityError(title);
        }
        transaction.delete(doc(firebaseDb(), 'pacingActivityNames', activity.titleKey));
        transaction.set(newNameRef, {
          activityId: activity.id,
          authorUid: uid,
        });
      }
      transaction.update(activityRef, {
        title,
        titleKey,
        description,
        kind: normalizePacingKind(input.kind),
        energyCost: clampDifficulty(input.energyCost),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async deleteActivity(activity: PacingActivity): Promise<void> {
    this.requirePacingAccess();
    await runTransaction(firebaseDb(), async (transaction) => {
      transaction.delete(doc(firebaseDb(), 'pacingActivities', activity.id));
      transaction.delete(doc(firebaseDb(), 'pacingActivityNames', activity.titleKey));
    });
  }

  async addLog(input: CreatePacingLogInput): Promise<void> {
    const uid = this.requirePacingAccess();
    this.requireSameDay(input.date);
    await addDoc(collection(firebaseDb(), 'pacingLogs'), {
      date: input.date,
      time: normalizePacingTime(input.time) || nowTimeKey(),
      activityId: input.activity.id,
      title: input.activity.title,
      description: input.activity.description,
      kind: normalizePacingKind(input.activity.kind),
      done: input.done,
      difficulty: clampDifficulty(input.difficulty),
      authorUid: uid,
      authorName: this.auth.username() ?? 'Unbekannt',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateLog(
    log: PacingLog,
    patch: {
      done?: boolean;
      difficulty?: number;
      time?: string;
      activity?: PacingActivity;
    },
  ): Promise<void> {
    this.requirePacingAccess();
    this.requireSameDay(log.date);
    const time = normalizePacingTime(patch.time ?? log.time);
    const activity = patch.activity;
    await updateDoc(doc(firebaseDb(), 'pacingLogs', log.id), {
      done: patch.done ?? log.done,
      difficulty: clampDifficulty(patch.difficulty ?? log.difficulty),
      title: activity?.title ?? log.title,
      description: activity?.description ?? log.description,
      kind: normalizePacingKind(activity?.kind ?? log.kind),
      activityId: activity?.id ?? log.activityId,
      date: log.date,
      time: time || nowTimeKey(),
      authorUid: log.authorUid,
      authorName: log.authorName,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteLog(log: PacingLog): Promise<void> {
    this.requirePacingAccess();
    this.requireSameDay(log.date);
    await deleteDoc(doc(firebaseDb(), 'pacingLogs', log.id));
  }

  async saveDay(input: SavePacingDayInput): Promise<void> {
    const uid = this.requirePacingAccess();
    this.requireSameDay(input.date);
    const existing = this.dayByDate(input.date);
    await setDoc(
      doc(firebaseDb(), 'pacingDays', input.date),
      {
        date: input.date,
        energy: clampDifficulty(input.energy),
        pem: Boolean(input.pem),
        budget: clampBudget(input.budget),
        authorUid: uid,
        authorName: this.auth.username() ?? 'Unbekannt',
        updatedAt: serverTimestamp(),
        ...(existing ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
  }

  private watchActivities(): void {
    this.stopWatchingActivities();
    this.activitiesUnsub = onSnapshot(
      collection(firebaseDb(), 'pacingActivities'),
      (snapshot) => {
        this.activitiesState.set(
          snapshot.docs
            .map(toPacingActivity)
            .sort((a, b) => a.title.localeCompare(b.title, 'de')),
        );
        this.activitiesReadyState.set(true);
      },
      () => this.activitiesReadyState.set(true),
    );
  }

  private watchLogs(): void {
    this.stopWatchingLogs();
    this.logsUnsub = onSnapshot(
      collection(firebaseDb(), 'pacingLogs'),
      (snapshot) => {
        this.logsState.set(snapshot.docs.map(toPacingLog));
        this.logsReadyState.set(true);
      },
      () => this.logsReadyState.set(true),
    );
  }

  private watchDays(): void {
    this.stopWatchingDays();
    this.daysUnsub = onSnapshot(
      collection(firebaseDb(), 'pacingDays'),
      (snapshot) => {
        this.daysState.set(snapshot.docs.map(toPacingDay));
        this.daysReadyState.set(true);
      },
      () => this.daysReadyState.set(true),
    );
  }

  private stopWatchingActivities(): void {
    this.activitiesUnsub?.();
    this.activitiesUnsub = null;
  }

  private stopWatchingLogs(): void {
    this.logsUnsub?.();
    this.logsUnsub = null;
  }

  private stopWatchingDays(): void {
    this.daysUnsub?.();
    this.daysUnsub = null;
  }

  private requireSameDay(date: string): void {
    if (!isPacingLogToday(date)) {
      throw new SameDayPacingError();
    }
  }

  private requirePacingAccess(): string {
    const uid = this.auth.uid();
    if (!uid) {
      throw new Error('Bitte erneut anmelden.');
    }
    if (!this.auth.canSeePacing()) {
      throw new Error('Kein Zugriff auf Pacing.');
    }
    return uid;
  }
}

function toPacingActivity(snapshot: QueryDocumentSnapshot<DocumentData>): PacingActivity {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: String(data['title'] ?? ''),
    titleKey: String(data['titleKey'] ?? ''),
    description: String(data['description'] ?? ''),
    kind: normalizePacingKind(data['kind']),
    energyCost: clampDifficulty(data['energyCost'] ?? 3),
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

function toPacingLog(snapshot: QueryDocumentSnapshot<DocumentData>): PacingLog {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    date: String(data['date'] ?? ''),
    time: normalizePacingTime(data['time'], toDate(data['createdAt'])),
    activityId: String(data['activityId'] ?? data['itemId'] ?? ''),
    title: String(data['title'] ?? ''),
    description: String(data['description'] ?? ''),
    kind: normalizePacingKind(data['kind']),
    done: Boolean(data['done']),
    difficulty: clampDifficulty(data['difficulty']),
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

function toPacingDay(snapshot: QueryDocumentSnapshot<DocumentData>): PacingDay {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    date: String(data['date'] ?? snapshot.id),
    energy: clampDifficulty(data['energy']),
    pem: Boolean(data['pem']),
    budget: clampBudget(data['budget']),
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}
