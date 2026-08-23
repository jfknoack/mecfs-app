import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import {
  DEFAULT_ROUTINE_COLOR,
  isoWeekday,
  parseDateKey,
  recurrenceLabel,
  ROUTINE_COLOR_OPTIONS,
  routineColorHex,
  routineIconClass,
  RoutineColor,
  RoutineRecurrence,
  RoutineVisibility,
  timeLabel,
  toDateKey,
  todayDateKey,
  WEEKDAY_OPTIONS,
} from '../../core/routines/routine.model';
import { RoutineService } from '../../core/routines/routine.service';

@Component({
  imports: [
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  selector: 'app-routinen',
  styleUrl: './routinen.scss',
  templateUrl: './routinen.html',
})
export class Routinen {
  private readonly formBuilder = inject(FormBuilder);
  private readonly routines = inject(RoutineService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly isAdmin = inject(Auth).isAdmin;

  protected readonly title = 'Routinen';
  protected readonly iconClass = routineIconClass;
  protected readonly colorOptions = ROUTINE_COLOR_OPTIONS;
  protected readonly colorHex = routineColorHex;
  protected readonly weekdayOptions = WEEKDAY_OPTIONS;
  protected readonly recurrenceLabel = recurrenceLabel;
  protected readonly timeLabel = timeLabel;
  protected readonly saving = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly routinesReady = this.routines.routinesReady;
  protected readonly routineItems = this.routines.routines;

  protected readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    date: [parseDateKey(todayDateKey()), Validators.required],
    timeFrom: ['08:00', Validators.required],
    timeTo: [''],
    recurrence: this.formBuilder.nonNullable.control<RoutineRecurrence>('once'),
    weekdays: this.formBuilder.nonNullable.control<number[]>([]),
    visibility: this.formBuilder.nonNullable.control<RoutineVisibility>('private'),
    color: this.formBuilder.nonNullable.control<RoutineColor>(DEFAULT_ROUTINE_COLOR),
  });

  protected toggleCreate(): void {
    if (!this.isAdmin()) {
      return;
    }
    const next = !this.showCreate();
    this.showCreate.set(next);
    if (next) {
      this.resetForm();
    }
  }

  protected isWeekdaySelected(day: number): boolean {
    return this.form.controls.weekdays.value.includes(day);
  }

  protected toggleWeekday(day: number): void {
    const current = this.form.controls.weekdays.value;
    const next = current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b);
    this.form.controls.weekdays.setValue(next);
  }

  protected selectColor(color: RoutineColor): void {
    this.form.controls.color.setValue(color);
  }

  protected onRecurrenceChange(): void {
    if (this.form.controls.recurrence.value !== 'weekly') {
      this.form.controls.weekdays.setValue([]);
      return;
    }
    if (!this.form.controls.weekdays.value.length) {
      const date = this.form.controls.date.value ?? parseDateKey(todayDateKey());
      this.form.controls.weekdays.setValue([isoWeekday(date)]);
    }
  }

  protected async createRoutine(): Promise<void> {
    if (!this.isAdmin() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const id = await this.routines.createRoutine({
        ...value,
        date: toDateKey(value.date),
      });
      this.resetForm();
      this.showCreate.set(false);
      this.snackBar.open('Routine gespeichert.', 'OK', { duration: 2500 });
      await this.router.navigate(['/routinen', id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Routine konnte nicht gespeichert werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      date: parseDateKey(todayDateKey()),
      timeFrom: '08:00',
      timeTo: '',
      recurrence: 'once',
      weekdays: [],
      visibility: 'private',
      color: DEFAULT_ROUTINE_COLOR,
    });
  }
}
