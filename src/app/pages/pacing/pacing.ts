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
  DIFFICULTY_OPTIONS,
  difficultyColor,
  difficultyContrast,
  difficultyLabel,
  isPacingLogToday,
  nowTimeKey,
  PacingLog,
} from '../../core/pacing/pacing.model';
import { PacingService, SameDayPacingError } from '../../core/pacing/pacing.service';
import { addDateKeyDays, formatDateLabel, todayDateKey } from '../../core/routines/routine.model';

interface PacingDayColumn {
  key: string;
  name: string;
  today: boolean;
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
  private readonly pacing = inject(PacingService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly title = 'Pacing';
  protected readonly iconClass = listIconClass;
  protected readonly colorOf = difficultyColor;
  protected readonly contrastOf = difficultyContrast;
  protected readonly difficultyText = difficultyLabel;
  protected readonly difficultyOptions = DIFFICULTY_OPTIONS;
  protected readonly formatDateLabel = formatDateLabel;
  protected readonly activities = this.pacing.activities;
  protected readonly logsReady = this.pacing.logsReady;
  protected readonly editingLogId = signal<string | null>(null);
  protected readonly showPopover = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    date: [todayDateKey(), Validators.required],
    time: [nowTimeKey(), Validators.required],
    activityId: ['', Validators.required],
    difficulty: this.formBuilder.nonNullable.control(3),
    done: true,
  });

  protected readonly columns = computed<PacingDayColumn[]>(() => {
    const today = todayDateKey();
    return [
      { key: addDateKeyDays(today, -2), name: 'Vorgestern', today: false },
      { key: addDateKeyDays(today, -1), name: 'Gestern', today: false },
      { key: today, name: 'Heute', today: true },
    ];
  });

  protected readonly editingLog = computed(() => {
    const id = this.editingLogId();
    return id ? (this.pacing.logById(id) ?? null) : null;
  });
  protected readonly popoverEditable = computed(() => {
    const log = this.editingLog();
    return log ? isPacingLogToday(log.date) : true;
  });
  protected readonly popoverTitle = computed(() => {
    if (!this.editingLog()) {
      return 'Karte hinzufügen';
    }
    return this.popoverEditable() ? 'Karte bearbeiten' : 'Karte';
  });

  protected logsFor(date: string): PacingLog[] {
    return this.pacing.logsOnDate(date);
  }

  protected toggleAdd(): void {
    if (this.showPopover() && !this.editingLogId()) {
      this.closePopover();
      return;
    }
    this.openCreate();
  }

  protected openCreate(): void {
    this.editingLogId.set(null);
    this.showPopover.set(true);
    this.form.enable();
    this.form.reset({
      date: todayDateKey(),
      time: nowTimeKey(),
      activityId: this.activities()[0]?.id ?? '',
      difficulty: 3,
      done: true,
    });
  }

  protected openEdit(log: PacingLog): void {
    this.editingLogId.set(log.id);
    this.showPopover.set(true);
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

  protected closePopover(): void {
    this.form.enable();
    this.showPopover.set(false);
    this.editingLogId.set(null);
  }

  protected onDocumentEscape(): void {
    if (this.showPopover()) {
      this.closePopover();
    }
  }

  protected selectDifficulty(value: number): void {
    if (!this.popoverEditable()) {
      return;
    }
    this.form.controls.difficulty.setValue(value);
  }

  protected async saveLog(): Promise<void> {
    if (!this.popoverEditable()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!isPacingLogToday(value.date)) {
      this.snackBar.open('Karten können nur am selben Tag erstellt und bearbeitet werden.', 'OK', {
        duration: 4000,
      });
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
        error instanceof SameDayPacingError
          ? error.message
          : 'Karte konnte nicht gespeichert werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteEditing(): Promise<void> {
    const log = this.editingLog();
    if (!log || !this.popoverEditable()) {
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
