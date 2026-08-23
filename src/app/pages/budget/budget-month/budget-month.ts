import { DatePipe, NgClass } from '@angular/common';
import { DestroyRef, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import {
  budgetIconClass,
  categoriesFor,
  categoryById,
  INCOME_CATEGORIES,
} from '../../../core/budget/budget-icons';
import {
  BudgetCategory,
  BudgetKind,
  formatEuro,
  monthLabel,
  parseEuro,
  toYearMonth,
} from '../../../core/budget/budget.model';
import { BudgetService } from '../../../core/budget/budget.service';

@Component({
  imports: [
    DatePipe,
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  selector: 'app-budget-month',
  styleUrl: './budget-month.scss',
  templateUrl: './budget-month.html',
})
export class BudgetMonth {
  private readonly auth = inject(Auth);
  private readonly budget = inject(BudgetService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly iconClass = budgetIconClass;
  protected readonly formatEuro = formatEuro;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly entriesReady = this.budget.entriesReady;
  protected readonly saving = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly kind = signal<BudgetKind>('income');
  protected readonly category = signal<BudgetCategory>('pflegegeld');

  protected readonly year = Number(this.route.snapshot.paramMap.get('year'));
  protected readonly month = Number(this.route.snapshot.paramMap.get('month'));
  protected readonly valid =
    Number.isInteger(this.year) &&
    this.year >= 2020 &&
    this.year <= 2100 &&
    Number.isInteger(this.month) &&
    this.month >= 1 &&
    this.month <= 12;
  protected readonly monthTitle = this.valid ? `${monthLabel(this.month)} ${this.year}` : 'Monat';

  protected readonly form = this.formBuilder.nonNullable.group({
    kind: this.formBuilder.nonNullable.control<BudgetKind>('income'),
    category: this.formBuilder.nonNullable.control<BudgetCategory>('pflegegeld'),
    title: ['Pflegegeld', [Validators.required, Validators.maxLength(80)]],
    amount: ['', Validators.required],
    note: ['', Validators.maxLength(300)],
  });

  protected readonly categoryOptions = computed(() => categoriesFor(this.kind()));

  protected readonly incomeEntries = computed(() =>
    this.budget.entries().filter((entry) => entry.kind === 'income'),
  );
  protected readonly expenseEntries = computed(() =>
    this.budget.entries().filter((entry) => entry.kind === 'expense'),
  );
  protected readonly totals = computed(() => {
    const income = this.incomeEntries().reduce((sum, entry) => sum + entry.amount, 0);
    const expense = this.expenseEntries().reduce((sum, entry) => sum + entry.amount, 0);
    return { income, expense, balance: income - expense };
  });

  constructor() {
    void this.auth.ensureUserDoc();
    if (this.valid) {
      this.budget.watchEntries(toYearMonth(this.year, this.month));
    }
    this.destroyRef.onDestroy(() => this.budget.stopWatchingEntries());
  }

  protected selectedCategory(): BudgetCategory {
    return this.category();
  }

  protected categoryLabel(id: BudgetCategory): string {
    return categoryById(id)?.label ?? id;
  }

  protected titlePlaceholder(): string {
    return this.kind() === 'income' && this.category() === 'supporter'
      ? 'Name des Supporters / Spenders'
      : 'Bezeichnung';
  }

  protected onKindChange(value: unknown): void {
    const kind: BudgetKind = value === 'expense' ? 'expense' : 'income';
    const first = categoriesFor(kind)[0];
    this.kind.set(kind);
    this.category.set(first.id);
    this.form.patchValue({
      kind,
      category: first.id,
      title: first.label,
    });
  }

  protected selectCategory(category: BudgetCategory): void {
    const option = categoryById(category);
    if (!option) {
      return;
    }
    const currentTitle = this.form.controls.title.value;
    const labels = this.categoryOptions().map((item) => item.label);
    this.category.set(option.id);
    this.form.controls.category.setValue(option.id);
    if (!currentTitle.trim() || labels.includes(currentTitle)) {
      this.form.controls.title.setValue(option.label);
    }
  }

  protected toggleCreate(): void {
    const next = !this.showCreate();
    this.showCreate.set(next);
    if (next) {
      this.resetForm();
    }
  }

  protected async saveEntry(): Promise<void> {
    if (!this.valid || !this.isAdmin()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const amount = parseEuro(raw.amount);
    if (amount === null) {
      this.form.controls.amount.setErrors({ invalid: true });
      return;
    }

    const option = categoryById(raw.category);
    this.saving.set(true);
    try {
      await this.auth.ensureUserDoc();
      await this.budget.addEntry({
        year: this.year,
        month: this.month,
        kind: raw.kind,
        category: raw.category,
        title: raw.title,
        amount,
        icon: option?.icon ?? 'coins',
        note: raw.note,
      });
      this.resetForm();
      this.showCreate.set(false);
      this.snackBar.open('Buchung gespeichert.', 'OK', { duration: 2500 });
    } catch {
      this.snackBar.open('Buchung konnte nicht gespeichert werden.', 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteEntry(entryId: string): Promise<void> {
    if (!this.isAdmin()) {
      return;
    }
    const entry = this.budget.entries().find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    const confirmed = window.confirm(`„${entry.title}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.budget.deleteEntry(entry);
    } catch {
      this.snackBar.open('Buchung konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }

  private resetForm(): void {
    this.kind.set('income');
    this.category.set('pflegegeld');
    this.form.reset({
      kind: 'income',
      category: 'pflegegeld',
      title: INCOME_CATEGORIES[0].label,
      amount: '',
      note: '',
    });
  }
}
