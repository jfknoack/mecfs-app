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

export function toYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? '';
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
