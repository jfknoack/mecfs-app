import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { recipeIconClass, RecipeVisibility } from '../../core/recipes/recipe.model';
import { RecipeService } from '../../core/recipes/recipe.service';

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
  selector: 'app-rezepte',
  styleUrl: './rezepte.scss',
  templateUrl: './rezepte.html',
})
export class Rezepte {
  private readonly formBuilder = inject(FormBuilder);
  private readonly recipes = inject(RecipeService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly isAdmin = inject(Auth).isAdmin;

  protected readonly title = 'Rezepte';
  protected readonly iconClass = recipeIconClass;
  protected readonly saving = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly recipesReady = this.recipes.recipesReady;
  protected readonly recipeItems = this.recipes.recipes;

  protected readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(2000)],
    visibility: this.formBuilder.nonNullable.control<RecipeVisibility>('private'),
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

  protected async createRecipe(): Promise<void> {
    if (!this.isAdmin() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    try {
      const id = await this.recipes.createRecipe(this.form.getRawValue());
      this.resetForm();
      this.showCreate.set(false);
      this.snackBar.open('Rezept gespeichert.', 'OK', { duration: 2500 });
      await this.router.navigate(['/rezepte', id]);
    } catch {
      this.snackBar.open('Rezept konnte nicht gespeichert werden.', 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  private resetForm(): void {
    this.form.reset({ title: '', description: '', visibility: 'private' });
  }
}
