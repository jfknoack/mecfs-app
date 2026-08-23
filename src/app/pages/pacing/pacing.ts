import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { listIconClass } from '../../core/lists/list-icons';
import {
  costSign,
  dayBalance,
  DIFFICULTY_OPTIONS,
  difficultyColor,
  difficultyContrast,
  difficultyLabel,
  envelopeZoneColor,
  frequentActivities,
  isPacingLogToday,
  isRestKind,
  nowTimeKey,
  PACING_KIND_OPTIONS,
  PacingActivity,
  PacingDay,
  PacingDayBalance,
  PacingKind,
  PacingLog,
  pacingKindIcon,
  pacingKindLabel,
  pemPatternHint,
  restCreditLabel,
  suggestedCost,
} from '../../core/pacing/pacing.model';
import { Auth } from '../../core/auth/auth';
import { PacingPermissionError, PacingService, SameDayPacingError } from '../../core/pacing/pacing.service';
import {
  addDateKeyDays,
  formatDateLabel,
  parseDateKey,
  todayDateKey,
} from '../../core/routines/routine.model';

type PacingPopover = 'log' | 'day';

interface PacingDayColumn {
  key: string;
  name: string;
  today: boolean;
  logs: PacingLog[];
  day: PacingDay | undefined;
  balance: PacingDayBalance;
  hint: string | null;
}

interface PacingWeekDay {
  key: string;
  weekday: string;
  today: boolean;
  zone: PacingDayBalance['zone'] | null;
}

interface ActivityGroup {
  value: PacingKind;
  label: string;
  items: PacingActivity[];
}

@Component({
  imports: [
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  host: {
    '(document:keydown.escape)': 'onDocumentEscape()',
  },
  selector: 'app-pacing',
  styleUrl: './pacing.scss',
  templateUrl: './pacing.html',
})
export class Pacing {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly pacing = inject(PacingService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly canLog = this.auth.canLogPacing;
  protected readonly bellScore = this.pacing.bellScore;

  protected readonly title = 'Pacing';
  protected readonly iconClass = listIconClass;
  protected readonly colorOf = difficultyColor;
  protected readonly contrastOf = difficultyContrast;
  protected readonly difficultyText = difficultyLabel;
  protected readonly restText = restCreditLabel;
  protected readonly kindLabel = pacingKindLabel;
  protected readonly kindIcon = pacingKindIcon;
  protected readonly costOf = costSign;
  protected readonly isRest = isRestKind;
  protected readonly zoneColor = envelopeZoneColor;
  protected readonly difficultyOptions = DIFFICULTY_OPTIONS;
  protected readonly formatDateLabel = formatDateLabel;
  protected readonly activities = this.pacing.activities;
  protected readonly logsReady = this.pacing.logsReady;
  protected readonly editingLogId = signal<string | null>(null);
  protected readonly popover = signal<PacingPopover | null>(null);
  protected readonly viewingDayKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    date: [todayDateKey(), Validators.required],
    time: [nowTimeKey(), Validators.required],
    activityId: ['', Validators.required],
    difficulty: this.formBuilder.nonNullable.control(3),
    done: true,
  });

  protected readonly dayForm = this.formBuilder.nonNullable.group({
    energy: this.formBuilder.nonNullable.control(6),
    pem: false,
    budget: this.formBuilder.nonNullable.control(20, [Validators.required, Validators.min(1)]),
  });

  protected readonly columns = computed<PacingDayColumn[]>(() => {
    const today = todayDateKey();
    const priorKey = addDateKeyDays(today, -2);
    const priorBalance = dayBalance(this.pacing.logsOnDate(priorKey), this.pacing.budgetFor(priorKey));
    return [
      { key: priorKey, name: 'Vorgestern', today: false },
      { key: addDateKeyDays(today, -1), name: 'Gestern', today: false },
      { key: today, name: 'Heute', today: true },
    ].map((column) => {
      const logs = this.pacing.logsOnDate(column.key);
      const day = this.pacing.dayByDate(column.key);
      const balance = dayBalance(logs, this.pacing.budgetFor(column.key));
      return {
        ...column,
        logs,
        day,
        balance,
        hint: column.today
          ? pemPatternHint({
              todayEnergy: day ? day.energy : null,
              todayPem: Boolean(day?.pem),
              priorNet: priorBalance.net,
              priorBudget: priorBalance.budget,
            })
          : null,
      };
    });
  });

  protected readonly weekDays = computed<PacingWeekDay[]>(() => {
    const today = todayDateKey();
    return Array.from({ length: 7 }, (_, index) => {
      const key = addDateKeyDays(today, index - 6);
      const logs = this.pacing.logsOnDate(key);
      const day = this.pacing.dayByDate(key);
      return {
        key,
        weekday: parseDateKey(key).toLocaleDateString('de-DE', { weekday: 'short' }),
        today: key === today,
        zone: logs.length || day ? dayBalance(logs, this.pacing.budgetFor(key)).zone : null,
      };
    });
  });

  protected readonly shortcuts = computed(() =>
    frequentActivities(this.activities(), this.pacing.logs()),
  );

  protected readonly activityGroups = computed<ActivityGroup[]>(() =>
    PACING_KIND_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      items: this.activities().filter((activity) => activity.kind === option.value),
    })).filter((group) => group.items.length),
  );

  protected readonly editingLog = computed(() => {
    const id = this.editingLogId();
    return id ? (this.pacing.logById(id) ?? null) : null;
  });

  protected readonly selectedActivity = computed(() => {
    const id = this.form.controls.activityId.value;
    return this.pacing.activityById(id) ?? null;
  });

  protected readonly selectedRest = computed(() => {
    const activity = this.selectedActivity();
    return activity ? isRestKind(activity.kind) : false;
  });

  protected readonly dayEditable = computed(
    () => this.canLog() && isPacingLogToday(this.viewingDayKey() ?? todayDateKey()),
  );

  protected readonly logEditable = computed(() => {
    if (!this.canLog()) {
      return false;
    }
    const log = this.editingLog();
    return log ? isPacingLogToday(log.date) : true;
  });

  protected readonly popoverTitle = computed(() => {
    if (this.popover() === 'day') {
      return 'Check-in';
    }
    if (!this.editingLog()) {
      return this.selectedRest() ? 'Pause eintragen' : 'Karte hinzufügen';
    }
    return this.logEditable() ? 'Karte bearbeiten' : 'Karte';
  });

  protected toggleAdd(): void {
    if (!this.canLog()) {
      return;
    }
    if (this.popover() === 'log' && !this.editingLogId()) {
      this.closePopover();
      return;
    }
    this.openCreate();
  }

  protected openCreate(activityId?: string): void {
    if (!this.canLog()) {
      return;
    }
    const activity =
      (activityId ? this.pacing.activityById(activityId) : undefined) ?? this.activities()[0];
    this.editingLogId.set(null);
    this.viewingDayKey.set(null);
    this.popover.set('log');
    this.form.enable();
    this.form.reset({
      date: todayDateKey(),
      time: nowTimeKey(),
      activityId: activity?.id ?? '',
      difficulty: activity ? suggestedCost(activity, this.pacing.logs()) : 3,
      done: true,
    });
  }

  protected openEdit(log: PacingLog): void {
    this.editingLogId.set(log.id);
    this.viewingDayKey.set(null);
    this.popover.set('log');
    this.form.enable();
    const activityId = this.pacing.activityById(log.activityId)?.id ?? this.activities()[0]?.id ?? '';
    this.form.reset({
      date: log.date,
      time: log.time || nowTimeKey(),
      activityId,
      difficulty: log.difficulty,
      done: log.done,
    });
    if (!isPacingLogToday(log.date)) {
      this.form.disable({ emitEvent: false });
    }
  }

  protected openDay(date: string): void {
    this.editingLogId.set(null);
    this.viewingDayKey.set(date);
    this.popover.set('day');
    this.dayForm.enable();
    const day = this.pacing.dayByDate(date);
    this.dayForm.reset({
      energy: day?.energy ?? 6,
      pem: Boolean(day?.pem),
      budget: day?.budget ?? this.pacing.lastBudget(),
    });
    if (!isPacingLogToday(date)) {
      this.dayForm.disable({ emitEvent: false });
    }
  }

  protected closePopover(): void {
    this.form.enable();
    this.dayForm.enable();
    this.popover.set(null);
    this.editingLogId.set(null);
    this.viewingDayKey.set(null);
  }

  protected onDocumentEscape(): void {
    if (this.popover()) {
      this.closePopover();
    }
  }

  protected onActivityChange(activityId: string): void {
    if (!this.logEditable()) {
      return;
    }
    const activity = this.pacing.activityById(activityId);
    if (!activity) {
      return;
    }
    this.form.controls.difficulty.setValue(suggestedCost(activity, this.pacing.logs()));
  }

  protected selectDifficulty(value: number): void {
    if (!this.logEditable()) {
      return;
    }
    this.form.controls.difficulty.setValue(value);
  }

  protected selectEnergy(value: number): void {
    if (!this.dayEditable()) {
      return;
    }
    this.dayForm.controls.energy.setValue(value);
  }

  protected async saveLog(): Promise<void> {
    if (!this.logEditable()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!isPacingLogToday(value.date)) {
      this.snackBar.open('Nur der heutige Tag kann geändert werden.', 'OK', { duration: 4000 });
      return;
    }
    const activity = this.activities().find((item) => item.id === value.activityId);
    if (!activity) {
      return;
    }
    this.saving.set(true);
    try {
      const editing = this.editingLog();
      if (editing) {
        await this.pacing.updateLog(editing, {
          activity,
          time: value.time,
          done: value.done,
          difficulty: value.difficulty,
        });
      } else {
        await this.pacing.addLog({
          date: value.date,
          time: value.time,
          activity,
          done: value.done,
          difficulty: value.difficulty,
        });
      }
      this.closePopover();
    } catch (error) {
      const message =
        error instanceof SameDayPacingError || error instanceof PacingPermissionError
          ? error.message
          : 'Karte konnte nicht gespeichert werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveDay(): Promise<void> {
    if (!this.dayEditable()) {
      return;
    }
    if (this.dayForm.invalid) {
      this.dayForm.markAllAsTouched();
      return;
    }
    const value = this.dayForm.getRawValue();
    this.saving.set(true);
    try {
      await this.pacing.saveDay({
        date: this.viewingDayKey() ?? todayDateKey(),
        energy: value.energy,
        pem: value.pem,
        budget: value.budget,
      });
      this.closePopover();
    } catch (error) {
      const message =
        error instanceof SameDayPacingError || error instanceof PacingPermissionError
          ? error.message
          : 'Check-in konnte nicht gespeichert werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteEditing(): Promise<void> {
    const log = this.editingLog();
    if (!log || !this.logEditable()) {
      return;
    }
    const confirmed = window.confirm(`Karte „${log.title}" wirklich entfernen?`);
    if (!confirmed) {
      return;
    }
    this.saving.set(true);
    try {
      await this.pacing.deleteLog(log);
      this.closePopover();
    } catch (error) {
      const message =
        error instanceof SameDayPacingError
          ? error.message
          : 'Karte konnte nicht gelöscht werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
