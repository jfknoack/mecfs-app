import { DatePipe, NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { listIconClass } from '../../../core/lists/list-icons';
import { DuplicatePacingActivityError, PacingService } from '../../../core/pacing/pacing.service';

@Component({
  imports: [
    DatePipe,
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
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
  protected readonly saving = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly adding = signal(false);
  protected readonly activitiesReady = this.pacing.activitiesReady;
  protected readonly activities = this.pacing.activities;

  protected readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(2000)],
  });

  protected isEditing(id: string): boolean {
    return this.editingId() === id;
  }

  protected openAdd(): void {
    this.form.reset({ title: '', description: '' });
    this.editingId.set(null);
    this.adding.set(true);
  }

  protected openEdit(id: string): void {
    const activity = this.activities().find((item) => item.id === id);
    if (!activity) {
      return;
    }
    this.form.reset({ title: activity.title, description: activity.description });
    this.adding.set(false);
    this.editingId.set(id);
  }

  protected closeForm(): void {
    this.adding.set(false);
    this.editingId.set(null);
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
