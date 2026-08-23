import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserRole } from '../../core/auth/auth.model';
import {
  AllowedUserService,
  BootstrapUserError,
  DuplicateAllowedUserError,
} from '../../core/users/allowed-user.service';

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  selector: 'app-admin',
  styleUrl: './admin.scss',
  templateUrl: './admin.html',
})
export class Admin {
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly allowedUsers = inject(AllowedUserService);

  protected readonly title = 'Admin';
  protected readonly users = this.allowedUsers.users;
  protected readonly usersReady = this.allowedUsers.ready;
  protected readonly saving = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly isBootstrap = (email: string) => this.allowedUsers.isBootstrap(email);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(80)]],
    role: this.formBuilder.nonNullable.control<UserRole>('user'),
  });

  protected toggleCreate(): void {
    const next = !this.showCreate();
    this.showCreate.set(next);
    if (next) {
      this.form.reset({ name: '', email: '', role: 'user' });
    }
  }

  protected async createUser(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      await this.allowedUsers.createUser(this.form.getRawValue());
      this.form.reset({ name: '', email: '', role: 'user' });
      this.showCreate.set(false);
      this.snackBar.open('Benutzer angelegt. Die Person kann sich mit Google anmelden.', 'OK', {
        duration: 3500,
      });
    } catch (error) {
      this.snackBar.open(adminErrorMessage(error), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async setRole(email: string, role: UserRole): Promise<void> {
    try {
      await this.allowedUsers.updateUser(email, { role });
      this.snackBar.open('Rolle gespeichert.', 'OK', { duration: 2500 });
    } catch (error) {
      this.snackBar.open(adminErrorMessage(error), 'OK', { duration: 4000 });
    }
  }

  protected async deleteUser(email: string, name: string): Promise<void> {
    const confirmed = window.confirm(`„${name}" (${email}) wirklich entfernen?`);
    if (!confirmed) {
      return;
    }

    try {
      await this.allowedUsers.deleteUser(email);
      this.snackBar.open('Benutzer entfernt.', 'OK', { duration: 2500 });
    } catch (error) {
      this.snackBar.open(adminErrorMessage(error), 'OK', { duration: 4000 });
    }
  }
}

function adminErrorMessage(error: unknown): string {
  if (error instanceof DuplicateAllowedUserError || error instanceof BootstrapUserError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Speichern fehlgeschlagen.';
}
