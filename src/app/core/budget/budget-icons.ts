import {
  BudgetCategory,
  BudgetExpenseCategory,
  BudgetIncomeCategory,
  BudgetKind,
} from './budget.model';

export interface BudgetCategoryOption<T extends BudgetCategory = BudgetCategory> {
  id: T;
  label: string;
  icon: string;
}

export const INCOME_CATEGORIES: BudgetCategoryOption<BudgetIncomeCategory>[] = [
  { id: 'pflegegeld', label: 'Pflegegeld', icon: 'hand-holding-heart' },
  { id: 'supporter', label: 'Supporter / Spender', icon: 'hand-holding-dollar' },
  { id: 'sonstiges-einkommen', label: 'Sonstiges Einkommen', icon: 'coins' },
];

export const EXPENSE_CATEGORIES: BudgetCategoryOption<BudgetExpenseCategory>[] = [
  { id: 'medikamente', label: 'Medikamente', icon: 'pills' },
  { id: 'anschaffungen', label: 'Anschaffungen', icon: 'box-open' },
  { id: 'lebensmittel', label: 'Einkäufe / Lebensmittel', icon: 'cart-shopping' },
  { id: 'sonstige-ausgaben', label: 'Sonstige Ausgaben', icon: 'receipt' },
];

export function categoriesFor(kind: BudgetKind): BudgetCategoryOption[] {
  return kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryById(id: BudgetCategory): BudgetCategoryOption | undefined {
  return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].find((item) => item.id === id);
}

export function budgetIconClass(iconName: string): string {
  return `fa-solid fa-${iconName}`;
}
