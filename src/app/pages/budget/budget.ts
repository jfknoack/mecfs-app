import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { budgetIconClass } from '../../core/budget/budget-icons';
import {
  availableCreateMonths,
  availableCreateYears,
  currentYearMonth,
  formatEuro,
  MIN_BUDGET_YEAR,
  MONTH_LABELS,
  monthLabel,
  usagePercent,
} from '../../core/budget/budget.model';
import { BudgetService, DuplicateBudgetMonthError } from '../../core/budget/budget.service';

@Component({
  imports: [
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  selector: 'app-budget',
  styleUrl: './budget.scss',
  templateUrl: './budget.html',
})
export class Budget {
  private readonly auth = inject(Auth);
  private readonly budget = inject(BudgetService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly title = 'Budget';
  protected readonly iconClass = budgetIconClass;
  protected readonly monthLabel = monthLabel;
  protected readonly formatEuro = formatEuro;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly monthsReady = this.budget.monthsReady;

  private readonly today = currentYearMonth();
  protected readonly selectedYear = signal(this.today.year);
  protected readonly createYear = signal(this.today.year);
  protected readonly saving = signal(false);
  protected readonly showCreate = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    year: [this.today.year, Validators.required],
    month: [0, Validators.required],
  });

  protected readonly existingYearMonths = computed(() =>
    this.budget.months().map((month) => month.yearMonth),
  );

  protected readonly createYears = computed(() => availableCreateYears(this.existingYearMonths()));

  protected readonly createMonths = computed(() =>
    availableCreateMonths(this.createYear(), this.existingYearMonths()),
  );

  protected readonly canCreate = computed(() => this.isAdmin() && this.createYears().length > 0);

  protected readonly yearCards = computed(() => {
    const year = this.selectedYear();
    return this.budget
      .months()
      .filter((month) => month.year === year)
      .map((data) => {
        const income = data.incomeTotal;
        const expense = data.expenseTotal;
        return {
          month: data.month,
          label: MONTH_LABELS[data.month - 1] ?? '',
          yearMonth: data.yearMonth,
          income,
          expense,
          balance: income - expense,
          usage: usagePercent(income, expense),
          isCurrent: year === this.today.year && data.month === this.today.month,
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
  }

  protected canShiftYear(delta: number): boolean {
    const next = this.selectedYear() + delta;
    return next >= MIN_BUDGET_YEAR && next <= this.today.year;
  }

  protected shiftYear(delta: number): void {
    if (!this.canShiftYear(delta)) {
      return;
    }
    this.selectedYear.update((year) => year + delta);
  }

  protected toggleCreate(): void {
    if (!this.canCreate()) {
      return;
    }
    const next = !this.showCreate();
    this.showCreate.set(next);
    if (next) {
      this.resetCreateForm();
    }
  }

  protected onCreateYearChange(year: number): void {
    this.createYear.set(year);
    const months = availableCreateMonths(year, this.existingYearMonths());
    this.form.patchValue({ year, month: months[0] ?? 0 });
  }

  protected async createMonth(): Promise<void> {
    if (!this.canCreate()) {
      return;
    }
    const year = this.form.controls.year.value;
    const month = this.form.controls.month.value;
    if (!availableCreateMonths(year, this.existingYearMonths()).includes(month)) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      await this.budget.createMonth(year, month);
      this.showCreate.set(false);
      this.selectedYear.set(year);
      this.snackBar.open(`${monthLabel(month)} ${year} angelegt.`, 'OK', { duration: 2500 });
    } catch (error) {
      const message =
        error instanceof DuplicateBudgetMonthError
          ? error.message
          : 'Monat konnte nicht angelegt werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  private resetCreateForm(): void {
    const years = availableCreateYears(this.existingYearMonths());
    const year = years.includes(this.selectedYear()) ? this.selectedYear() : (years[0] ?? this.today.year);
    const months = availableCreateMonths(year, this.existingYearMonths());
    this.createYear.set(year);
    this.form.reset({ year, month: months[0] ?? 0 });
  }
}
