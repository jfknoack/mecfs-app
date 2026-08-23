import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { listIconClass } from '../../../core/lists/list-icons';
import {
  DIFFICULTY_OPTIONS,
  difficultyColor,
  difficultyContrast,
  PACING_KIND_OPTIONS,
  PacingActivity,
  PacingKind,
  suggestedCost,
} from '../../../core/pacing/pacing.model';
import { DuplicatePacingActivityError, PacingService } from '../../../core/pacing/pacing.service';

interface ActivityGroup {
  value: PacingKind;
  label: string;
  icon: string;
  items: PacingActivity[];
}

@Component({
  imports: [
    DatePipe,
    NgClass,
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  selector: 'app-pacing-aktivitaeten',
  styleUrl: './pacing-aktivitaeten.scss',
  templateUrl: './pacing-aktivitaeten.html',
})
export class PacingAktivitaeten {
  private readonly formBuilder = inject(FormBuilder);
  private readonly pacing = inject(PacingService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly title = 'Aktivitäten';
  protected readonly iconClass = listIconClass;
  protected readonly kindOptions = PACING_KIND_OPTIONS;
  protected readonly difficultyOptions = DIFFICULTY_OPTIONS;
  protected readonly colorOf = difficultyColor;
  protected readonly contrastOf = difficultyContrast;
  protected readonly saving = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly adding = signal(false);
  protected readonly activitiesReady = this.pacing.activitiesReady;
  protected readonly activities = this.pacing.activities;

  protected readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(2000)],
    kind: this.formBuilder.nonNullable.control<PacingKind>('household'),
    energyCost: this.formBuilder.nonNullable.control(3),
  });

  protected readonly groups = computed<ActivityGroup[]>(() =>
    PACING_KIND_OPTIONS.map((option) => ({
      ...option,
      items: this.activities().filter((activity) => activity.kind === option.value),
    })).filter((group) => group.items.length),
  );

  protected isEditing(id: string): boolean {
    return this.editingId() === id;
  }

  protected averageOf(activity: PacingActivity): number {
    return suggestedCost(activity, this.pacing.logs());
  }

  protected openAdd(): void {
    this.form.reset({ title: '', description: '', kind: 'household', energyCost: 3 });
    this.editingId.set(null);
    this.adding.set(true);
  }

  protected openEdit(id: string): void {
    const activity = this.activities().find((item) => item.id === id);
    if (!activity) {
      return;
    }
    this.form.reset({
      title: activity.title,
      description: activity.description,
      kind: activity.kind,
      energyCost: activity.energyCost,
    });
    this.adding.set(false);
    this.editingId.set(id);
  }

  protected closeForm(): void {
    this.adding.set(false);
    this.editingId.set(null);
  }

  protected selectCost(value: number): void {
    this.form.controls.energyCost.setValue(value);
  }

  protected async saveForm(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const id = this.editingId();
      if (id) {
        const activity = this.activities().find((item) => item.id === id);
        if (!activity) {
          return;
        }
        await this.pacing.updateActivity(activity, value);
      } else {
        await this.pacing.createActivity(value);
      }
      this.closeForm();
    } catch (error) {
      this.snackBar.open(
        error instanceof DuplicatePacingActivityError
          ? error.message
          : 'Aktivität konnte nicht gespeichert werden.',
        'OK',
        { duration: 4000 },
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteActivity(id: string): Promise<void> {
    const activity = this.activities().find((item) => item.id === id);
    if (!activity) {
      return;
    }
    const confirmed = window.confirm(`Aktivität „${activity.title}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.pacing.deleteActivity(activity);
      if (this.editingId() === id) {
        this.closeForm();
      }
    } catch {
      this.snackBar.open('Aktivität konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }
}
