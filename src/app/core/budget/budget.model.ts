export type BudgetKind = 'income' | 'expense';

export type BudgetIncomeCategory = 'pflegegeld' | 'supporter' | 'sonstiges-einkommen';
export type BudgetExpenseCategory =
  | 'medikamente'
  | 'anschaffungen'
  | 'lebensmittel'
  | 'sonstige-ausgaben';
export type BudgetCategory = BudgetIncomeCategory | BudgetExpenseCategory;

export interface BudgetMonth {
  id: string;
  year: number;
  month: number;
  yearMonth: string;
  incomeTotal: number;
  expenseTotal: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BudgetEntry {
  id: string;
  yearMonth: string;
  kind: BudgetKind;
  category: BudgetCategory;
  title: string;
  amount: number;
  icon: string;
  note: string;
  authorUid: string;
  authorName: string;
  createdAt: Date | null;
}

export interface CreateBudgetEntryInput {
  year: number;
  month: number;
  kind: BudgetKind;
  category: BudgetCategory;
  title: string;
  amount: number;
  icon: string;
  note: string;
}

export const MONTH_LABELS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

export const MIN_BUDGET_YEAR = 2020;

export function toYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? '';
}

export function currentYearMonth(now = new Date()): { year: number; month: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isValidCalendarMonth(year: number, month: number): boolean {
  return Number.isInteger(year) && Number.isInteger(month) && year >= MIN_BUDGET_YEAR && month >= 1 && month <= 12;
}

export function isFutureMonth(year: number, month: number, now = new Date()): boolean {
  const current = currentYearMonth(now);
  return year > current.year || (year === current.year && month > current.month);
}

export function isCurrentMonth(year: number, month: number, now = new Date()): boolean {
  const current = currentYearMonth(now);
  return year === current.year && month === current.month;
}

export function availableCreateYears(existingYearMonths: Iterable<string>, now = new Date()): number[] {
  const current = currentYearMonth(now);
  return Array.from({ length: current.year - MIN_BUDGET_YEAR + 1 }, (_, index) => current.year - index).filter(
    (year) => availableCreateMonths(year, existingYearMonths, now).length > 0,
  );
}

export function availableCreateMonths(
  year: number,
  existingYearMonths: Iterable<string>,
  now = new Date(),
): number[] {
  const current = currentYearMonth(now);
  if (!Number.isInteger(year) || year < MIN_BUDGET_YEAR || year > current.year) {
    return [];
  }

  const existing = new Set(existingYearMonths);
  const lastMonth = year < current.year ? 12 : current.month - 1;
  const months: number[] = [];
  for (let month = lastMonth; month >= 1; month -= 1) {
    if (!existing.has(toYearMonth(year, month))) {
      months.push(month);
    }
  }
  return months;
}

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseEuro(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) {
    return null;
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return null;
  }
  return roundCents(amount);
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function usagePercent(income: number, expense: number): number {
  if (income <= 0) {
    return expense > 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((expense / income) * 100));
}
