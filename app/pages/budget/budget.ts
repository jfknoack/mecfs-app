import { NgClass } from '@angular/common';
import { DestroyRef, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { budgetIconClass } from '../../core/budget/budget-icons';
import {
  formatEuro,
  MONTH_LABELS,
  toYearMonth,
  usagePercent,
} from '../../core/budget/budget.model';
import { BudgetService } from '../../core/budget/budget.service';

@Component({
  imports: [NgClass, RouterLink, MatButtonModule, MatIconModule],
  selector: 'app-budget',
  styleUrl: './budget.scss',
  templateUrl: './budget.html',
})
export class Budget {
  private readonly auth = inject(Auth);
  private readonly budget = inject(BudgetService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly title = 'Budget';
  protected readonly iconClass = budgetIconClass;
  protected readonly formatEuro = formatEuro;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly monthsReady = this.budget.monthsReady;

  private readonly today = new Date();
  protected readonly selectedYear = signal(this.today.getFullYear());

  protected readonly yearCards = computed(() => {
    const year = this.selectedYear();
    const byMonth = new Map(this.budget.months().map((month) => [month.month, month]));
    return MONTH_LABELS.map((label, index) => {
      const month = index + 1;
      const data = byMonth.get(month);
      const income = data?.incomeTotal ?? 0;
      const expense = data?.expenseTotal ?? 0;
      return {
        month,
        label,
        yearMonth: toYearMonth(year, month),
        income,
        expense,
        balance: income - expense,
        usage: usagePercent(income, expense),
        isCurrent: year === this.today.getFullYear() && month === this.today.getMonth() + 1,
      };
    });
  });

  protected readonly yearTotals = computed(() => {
    return this.yearCards().reduce(
      (totals, card) => ({
        income: totals.income + card.income,
        expense: totals.expense + card.expense,
        balance: totals.income + card.income - (totals.expense + card.expense),
      }),
      { income: 0, expense: 0, balance: 0 },
    );
  });

  constructor() {
    void this.auth.ensureUserDoc();
    this.budget.watchMonths(this.selectedYear());
    this.destroyRef.onDestroy(() => this.budget.stopWatchingMonths());
  }

  protected shiftYear(delta: number): void {
    const next = this.selectedYear() + delta;
    if (next < 2020 || next > this.today.getFullYear() + 1) {
      return;
    }
    this.selectedYear.set(next);
    this.budget.watchMonths(next);
  }
}
