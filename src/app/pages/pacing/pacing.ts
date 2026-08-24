import { NgClass } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { listIconClass } from '../../core/lists/list-icons';
import { budgetFromBellAndEnergy } from '../../core/pacing/bell-score.model';
import {
  costSign,
  dayBalance,
  DIFFICULTY_OPTIONS,
  difficultyLabel,
  scaleColor,
  scaleContrast,
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

interface ActivityGroup {
  value: PacingKind;
  label: string;
  items: PacingActivity[];
}

type PacingViewRange = 'today' | 'three' | 'week';

const PACING_VIEW_STORAGE_KEY = 'mecfs.pacing.view';
const PACING_VIEW_OPTIONS: ReadonlyArray<{
  value: PacingViewRange;
  label: string;
  bars: readonly number[];
}> = [
  { value: 'today', label: 'Heute, eine Spalte', bars: [0] },
  { value: 'three', label: '3 Tage, drei Spalten', bars: [0, 1, 2] },
  { value: 'week', label: 'Woche, mehrere Spalten', bars: [0, 1, 2, 3, 4, 5] },
];

function readPacingViewRange(): PacingViewRange {
  try {
    const stored = localStorage.getItem(PACING_VIEW_STORAGE_KEY);
    if (stored === 'today' || stored === 'three' || stored === 'week') {
      return stored;
    }
  } catch {
    return 'three';
  }
  return 'three';
}

function persistPacingViewRange(view: PacingViewRange): void {
  try {
    localStorage.setItem(PACING_VIEW_STORAGE_KEY, view);
  } catch {
    // Private mode or quota — keep the in-memory choice.
  }
}

function viewDayCount(view: PacingViewRange): number {
  if (view === 'today') {
    return 1;
  }
  if (view === 'week') {
    return 7;
  }
  return 3;
}

function columnTitle(key: string, today: string): string {
  if (key === today) {
    return 'Heute';
  }
  if (key === addDateKeyDays(today, -1)) {
    return 'Gestern';
  }
  if (key === addDateKeyDays(today, -2)) {
    return 'Vorgestern';
  }
  return parseDateKey(key).toLocaleDateString('de-DE', { weekday: 'long' });
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
  protected readonly colorOf = scaleColor;
  protected readonly contrastOf = scaleContrast;
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
  protected readonly viewRange = signal<PacingViewRange>(readPacingViewRange());
  protected readonly viewOptions = PACING_VIEW_OPTIONS;
  private readonly board = viewChild<ElementRef<HTMLElement>>('board');

  constructor() {
    afterNextRender(() => {
      if (this.viewRange() === 'week') {
        this.scrollTodayIntoView();
      }
    });
  }

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

  private readonly activityId = toSignal(this.form.controls.activityId.valueChanges, {
    initialValue: this.form.controls.activityId.value,
  });
  protected readonly selectedDifficulty = toSignal(this.form.controls.difficulty.valueChanges, {
    initialValue: this.form.controls.difficulty.value,
  });
  protected readonly selectedEnergy = toSignal(this.dayForm.controls.energy.valueChanges, {
    initialValue: this.dayForm.controls.energy.value,
  });

  protected readonly columns = computed<PacingDayColumn[]>(() => {
    const today = todayDateKey();
    const count = viewDayCount(this.viewRange());
    const priorKey = addDateKeyDays(today, -2);
    const priorBalance = dayBalance(this.pacing.logsOnDate(priorKey), this.pacing.budgetFor(priorKey));
    return Array.from({ length: count }, (_, index) => {
      const key = addDateKeyDays(today, index - (count - 1));
      const logs = this.pacing.logsOnDate(key);
      const day = this.pacing.dayByDate(key);
      const balance = dayBalance(logs, this.pacing.budgetFor(key));
      return {
        key,
        name: columnTitle(key, today),
        today: key === today,
        logs,
        day,
        balance,
        hint:
          key === today
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
    return this.pacing.activityById(this.activityId()) ?? null;
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

  protected setViewRange(view: PacingViewRange): void {
    this.viewRange.set(view);
    persistPacingViewRange(view);
    if (view === 'week') {
      setTimeout(() => this.scrollTodayIntoView());
    }
  }

  protected openCreate(activityId?: string): void {
    if (!this.canLog()) {
      return;
    }
    const activity =
      (activityId ? this.pacing.activityById(activityId) : undefined) ?? this.activities()[0];
    this.editingLogId.set(null);
    this.viewingDayKey.set(null);
    this.form.enable();
    this.form.reset({
      date: todayDateKey(),
      time: nowTimeKey(),
      activityId: activity?.id ?? '',
      difficulty: activity ? suggestedCost(activity, this.pacing.logs()) : 3,
      done: true,
    });
    this.popover.set('log');
  }

  protected openEdit(log: PacingLog): void {
    this.editingLogId.set(log.id);
    this.viewingDayKey.set(null);
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
    this.popover.set('log');
  }

  protected openDay(date: string): void {
    this.editingLogId.set(null);
    this.viewingDayKey.set(date);
    this.dayForm.enable();
    const day = this.pacing.dayByDate(date);
    const energy = day?.energy ?? 6;
    this.dayForm.reset({
      energy,
      pem: Boolean(day?.pem),
      budget: day?.budget ?? budgetFromBellAndEnergy(this.pacing.bellScore(), energy),
    });
    if (!isPacingLogToday(date)) {
      this.dayForm.disable({ emitEvent: false });
    }
    this.popover.set('day');
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
    this.dayForm.controls.budget.setValue(budgetFromBellAndEnergy(this.pacing.bellScore(), value));
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

  private scrollTodayIntoView(): void {
    this.board()?.nativeElement
      .querySelector<HTMLElement>('.pacing__column--today')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
}
