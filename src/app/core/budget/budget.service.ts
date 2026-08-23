import { effect, Injectable, signal, untracked } from '@angular/core';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { Auth } from '../auth/auth';
import { firebaseDb, isFirebaseConfigured } from '../firebase/firebase-app';
import {
  BudgetCategory,
  BudgetEntry,
  BudgetKind,
  BudgetMonth,
  CreateBudgetEntryInput,
  roundCents,
  toYearMonth,
} from './budget.model';

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly monthsState = signal<BudgetMonth[]>([]);
  private readonly entriesState = signal<BudgetEntry[]>([]);
  private readonly monthsReadyState = signal(false);
  private readonly entriesReadyState = signal(false);
  private monthsUnsub: Unsubscribe | null = null;
  private entriesUnsub: Unsubscribe | null = null;
  private desiredYear: number | null = null;
  private desiredYearMonth: string | null = null;
  private watchedYear: number | null = null;
  private watchedYearMonth: string | null = null;

  readonly months = this.monthsState.asReadonly();
  readonly monthsReady = this.monthsReadyState.asReadonly();
  readonly entries = this.entriesState.asReadonly();
  readonly entriesReady = this.entriesReadyState.asReadonly();

  constructor(private readonly auth: Auth) {
    effect(() => {
      const uid = this.auth.uid();
      untracked(() => {
        this.detachMonths();
        this.detachEntries();
        if (!isFirebaseConfigured() || !uid) {
          this.monthsState.set([]);
          this.entriesState.set([]);
          this.monthsReadyState.set(true);
          this.entriesReadyState.set(true);
          return;
        }
        this.attachMonths();
        this.attachEntries();
      });
    });
  }

  watchMonths(year: number): void {
    this.desiredYear = year;
    this.attachMonths();
  }

  stopWatchingMonths(): void {
    this.desiredYear = null;
    this.detachMonths();
    this.monthsState.set([]);
    this.monthsReadyState.set(false);
  }

  watchEntries(yearMonth: string): void {
    this.desiredYearMonth = yearMonth;
    this.attachEntries();
  }

  stopWatchingEntries(): void {
    this.desiredYearMonth = null;
    this.detachEntries();
    this.entriesState.set([]);
    this.entriesReadyState.set(false);
  }

  private attachMonths(): void {
    const year = this.desiredYear;
    if (year === null) {
      return;
    }
    if (this.watchedYear === year && this.monthsUnsub) {
      return;
    }

    this.detachMonths();
    this.watchedYear = year;

    if (!isFirebaseConfigured() || !this.auth.uid()) {
      this.monthsState.set([]);
      this.monthsReadyState.set(true);
      return;
    }

    const monthsRef = collection(firebaseDb(), 'budgetMonths');
    this.monthsUnsub = onSnapshot(
      query(monthsRef, where('year', '==', year)),
      (snapshot) => {
        const months = snapshot.docs
          .map((item) => toBudgetMonth(item))
          .sort((a, b) => a.month - b.month);
        this.monthsState.set(months);
        this.monthsReadyState.set(true);
      },
      () => this.monthsReadyState.set(true),
    );
  }

  private detachMonths(): void {
    this.monthsUnsub?.();
    this.monthsUnsub = null;
    this.watchedYear = null;
  }

  private attachEntries(): void {
    const yearMonth = this.desiredYearMonth;
    if (!yearMonth) {
      return;
    }
    if (this.watchedYearMonth === yearMonth && this.entriesUnsub) {
      return;
    }

    this.detachEntries();
    this.watchedYearMonth = yearMonth;

    if (!isFirebaseConfigured() || !this.auth.uid()) {
      this.entriesState.set([]);
      this.entriesReadyState.set(true);
      return;
    }

    const entriesRef = collection(firebaseDb(), 'budgetMonths', yearMonth, 'entries');
    this.entriesUnsub = onSnapshot(
      entriesRef,
      (snapshot) => {
        const entries = snapshot.docs
          .map((item) => toBudgetEntry(yearMonth, item))
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        this.entriesState.set(entries);
        this.entriesReadyState.set(true);
      },
      () => this.entriesReadyState.set(true),
    );
  }

  private detachEntries(): void {
    this.entriesUnsub?.();
    this.entriesUnsub = null;
    this.watchedYearMonth = null;
  }

  monthById(yearMonth: string): BudgetMonth | undefined {
    return this.monthsState().find((month) => month.id === yearMonth);
  }

  async addEntry(input: CreateBudgetEntryInput): Promise<void> {
    this.requireAdmin();
    const uid = this.requireUid();
    const title = input.title.trim().replace(/\s+/g, ' ');
    const note = input.note.trim();
    const amount = roundCents(input.amount);
    if (!title) {
      throw new Error('Bitte eine Bezeichnung angeben.');
    }
    if (!(amount > 0)) {
      throw new Error('Bitte einen Betrag größer 0 angeben.');
    }

    const yearMonth = toYearMonth(input.year, input.month);
    const monthRef = doc(firebaseDb(), 'budgetMonths', yearMonth);
    const entryRef = doc(collection(firebaseDb(), 'budgetMonths', yearMonth, 'entries'));

    await runTransaction(firebaseDb(), async (transaction) => {
      const monthSnap = await transaction.get(monthRef);
      const incomeDelta = input.kind === 'income' ? amount : 0;
      const expenseDelta = input.kind === 'expense' ? amount : 0;

      if (monthSnap.exists()) {
        const data = monthSnap.data();
        transaction.update(monthRef, {
          incomeTotal: roundCents(numberOrZero(data['incomeTotal']) + incomeDelta),
          expenseTotal: roundCents(numberOrZero(data['expenseTotal']) + expenseDelta),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(monthRef, {
          year: input.year,
          month: input.month,
          yearMonth,
          incomeTotal: incomeDelta,
          expenseTotal: expenseDelta,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      transaction.set(entryRef, {
        kind: input.kind,
        category: input.category,
        title,
        amount,
        icon: input.icon,
        note,
        authorUid: uid,
        authorName: this.auth.username() ?? 'Unbekannt',
        createdAt: serverTimestamp(),
      });
    });
  }

  async deleteEntry(entry: BudgetEntry): Promise<void> {
    this.requireAdmin();
    const monthRef = doc(firebaseDb(), 'budgetMonths', entry.yearMonth);
    const entryRef = doc(firebaseDb(), 'budgetMonths', entry.yearMonth, 'entries', entry.id);

    await runTransaction(firebaseDb(), async (transaction) => {
      const monthSnap = await transaction.get(monthRef);
      const entrySnap = await transaction.get(entryRef);
      if (!entrySnap.exists()) {
        return;
      }

      transaction.delete(entryRef);

      if (!monthSnap.exists()) {
        return;
      }

      const data = monthSnap.data();
      const amount = roundCents(numberOrZero(entrySnap.data()['amount']));
      const kind = entrySnap.data()['kind'] === 'expense' ? 'expense' : 'income';
      const incomeTotal = roundCents(
        Math.max(0, numberOrZero(data['incomeTotal']) - (kind === 'income' ? amount : 0)),
      );
      const expenseTotal = roundCents(
        Math.max(0, numberOrZero(data['expenseTotal']) - (kind === 'expense' ? amount : 0)),
      );

      if (incomeTotal <= 0 && expenseTotal <= 0) {
        transaction.delete(monthRef);
      } else {
        transaction.update(monthRef, {
          incomeTotal,
          expenseTotal,
          updatedAt: serverTimestamp(),
        });
      }
    });
  }

  private requireUid(): string {
    const uid = this.auth.uid();
    if (!uid) {
      throw new Error('Bitte erneut anmelden, um das Budget zu speichern.');
    }
    return uid;
  }

  private requireAdmin(): void {
    this.requireUid();
    if (!this.auth.isAdmin()) {
      throw new Error('Nur Admins können Ein- und Ausgaben erfassen.');
    }
  }
}

function toBudgetMonth(snapshot: QueryDocumentSnapshot<DocumentData>): BudgetMonth {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    year: numberOrZero(data['year']),
    month: numberOrZero(data['month']),
    yearMonth: String(data['yearMonth'] ?? snapshot.id),
    incomeTotal: roundCents(numberOrZero(data['incomeTotal'])),
    expenseTotal: roundCents(numberOrZero(data['expenseTotal'])),
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

function toBudgetEntry(
  yearMonth: string,
  snapshot: QueryDocumentSnapshot<DocumentData>,
): BudgetEntry {
  const data = snapshot.data();
  const kind: BudgetKind = data['kind'] === 'expense' ? 'expense' : 'income';
  return {
    id: snapshot.id,
    yearMonth,
    kind,
    category: toCategory(data['category'], kind),
    title: String(data['title'] ?? ''),
    amount: roundCents(numberOrZero(data['amount'])),
    icon: String(data['icon'] ?? 'coins'),
    note: String(data['note'] ?? ''),
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    createdAt: toDate(data['createdAt']),
  };
}

function toCategory(value: unknown, kind: BudgetKind): BudgetCategory {
  const id = String(value ?? '');
  const income: BudgetCategory[] = ['pflegegeld', 'supporter', 'sonstiges-einkommen'];
  const expense: BudgetCategory[] = [
    'medikamente',
    'anschaffungen',
    'lebensmittel',
    'sonstige-ausgaben',
  ];
  const allowed = kind === 'income' ? income : expense;
  return allowed.includes(id as BudgetCategory)
    ? (id as BudgetCategory)
    : kind === 'income'
      ? 'sonstiges-einkommen'
      : 'sonstige-ausgaben';
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}
