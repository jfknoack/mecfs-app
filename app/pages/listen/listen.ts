import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { LIST_ICON_OPTIONS, listIconClass } from '../../core/lists/list-icons';
import { ListVisibility } from '../../core/lists/list.model';
import { DuplicateListNameError, ListService } from '../../core/lists/list.service';

@Component({
  imports: [
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  selector: 'app-listen',
  styleUrl: './listen.scss',
  templateUrl: './listen.html',
})
export class Listen {
  private readonly formBuilder = inject(FormBuilder);
  private readonly lists = inject(ListService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly isAdmin = inject(Auth).isAdmin;

  protected readonly title = 'Listen';
  protected readonly iconOptions = LIST_ICON_OPTIONS;
  protected readonly iconClass = listIconClass;
  protected readonly saving = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly listsReady = this.lists.listsReady;
  protected readonly listItems = this.lists.lists;

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    icon: ['list', Validators.required],
    visibility: this.formBuilder.nonNullable.control<ListVisibility>('private'),
  });

  protected selectedIcon(): string {
    return this.form.controls.icon.value;
  }

  protected selectIcon(icon: string): void {
    this.form.controls.icon.setValue(icon);
  }

  protected toggleCreate(): void {
    if (!this.isAdmin()) {
      return;
    }
    const next = !this.showCreate();
    this.showCreate.set(next);
    if (next) {
      this.form.controls.visibility.setValue('private');
    }
  }

  protected async createList(): Promise<void> {
    if (!this.isAdmin() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      await this.lists.createList(this.form.getRawValue());
      this.form.reset({ name: '', icon: 'list', visibility: 'private' });
      this.showCreate.set(false);
      this.snackBar.open('Listentyp gespeichert.', 'OK', { duration: 2500 });
    } catch (error) {
      const message =
        error instanceof DuplicateListNameError
          ? error.message
          : 'Listentyp konnte nicht gespeichert werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
