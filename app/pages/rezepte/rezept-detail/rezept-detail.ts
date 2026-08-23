import { NgClass, NgTemplateOutlet } from '@angular/common';
import { afterNextRender, DestroyRef, Component, computed, inject, Injector, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { recipeIconClass, RecipeItem, RecipeVisibility } from '../../../core/recipes/recipe.model';
import { RecipeService } from '../../../core/recipes/recipe.service';

type RecipeFormMode = 'none' | 'recipe' | 'ingredient' | 'step';

@Component({
  imports: [
    NgClass,
    NgTemplateOutlet,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  selector: 'app-rezept-detail',
  styleUrl: './rezept-detail.scss',
  templateUrl: './rezept-detail.html',
})
export class RezeptDetail {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly recipes = inject(RecipeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly iconClass = recipeIconClass;
  protected readonly recipeId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly recipe = this.recipes.recipe;
  protected readonly recipeReady = this.recipes.recipeReady;
  protected readonly saving = signal(false);
  protected readonly formMode = signal<RecipeFormMode>('none');
  protected readonly editingId = signal<string | null>(null);
  protected readonly itemText = signal('');
  protected readonly ingredientsOpen = signal(true);

  protected readonly canEdit = computed(() => {
    const recipe = this.recipe();
    return !!recipe && this.recipes.canEdit(recipe);
  });

  protected readonly recipeForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(2000)],
    visibility: this.formBuilder.nonNullable.control<RecipeVisibility>('private'),
  });

  constructor() {
    this.recipes.watchRecipe(this.recipeId);
    this.destroyRef.onDestroy(() => this.recipes.stopWatchingRecipe());
  }

  protected isAddingIngredient(): boolean {
    return this.formMode() === 'ingredient' && this.editingId() === null;
  }

  protected isEditingIngredient(id: string): boolean {
    return this.formMode() === 'ingredient' && this.editingId() === id;
  }

  protected isAddingStep(): boolean {
    return this.formMode() === 'step' && this.editingId() === null;
  }

  protected isEditingStep(id: string): boolean {
    return this.formMode() === 'step' && this.editingId() === id;
  }

  protected toggleIngredients(): void {
    this.ingredientsOpen.update((open) => !open);
  }

  protected async dropIngredients(event: CdkDragDrop<RecipeItem[]>): Promise<void> {
    await this.dropItems(event, 'ingredients');
  }

  protected async dropSteps(event: CdkDragDrop<RecipeItem[]>): Promise<void> {
    await this.dropItems(event, 'steps');
  }

  protected openRecipeForm(): void {
    const recipe = this.recipe();
    if (!recipe || !this.canEdit()) {
      return;
    }
    this.recipeForm.reset({
      title: recipe.title,
      description: recipe.description,
      visibility: recipe.visibility,
    });
    this.formMode.set('recipe');
    this.editingId.set(null);
    this.focusInlineField();
  }

  protected openIngredientForm(id?: string): void {
    if (!this.canEdit()) {
      return;
    }
    const recipe = this.recipe();
    const item = recipe?.ingredients.find((entry) => entry.id === id);
    this.itemText.set(item?.text ?? '');
    this.editingId.set(id ?? null);
    this.formMode.set('ingredient');
    this.ingredientsOpen.set(true);
    this.focusInlineField();
  }

  protected openStepForm(id?: string): void {
    if (!this.canEdit()) {
      return;
    }
    const recipe = this.recipe();
    const item = recipe?.steps.find((entry) => entry.id === id);
    this.itemText.set(item?.text ?? '');
    this.editingId.set(id ?? null);
    this.formMode.set('step');
    this.focusInlineField();
  }

  protected closeForm(): void {
    this.formMode.set('none');
    this.editingId.set(null);
    this.itemText.set('');
  }

  protected onItemInput(event: Event): void {
    this.itemText.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected async saveForm(): Promise<void> {
    const recipe = this.recipe();
    if (!recipe || !this.canEdit()) {
      return;
    }

    this.saving.set(true);
    try {
      const mode = this.formMode();
      const current = this.recipes.recipe() ?? recipe;
      if (mode === 'recipe') {
        if (this.recipeForm.invalid) {
          this.recipeForm.markAllAsTouched();
          this.saving.set(false);
          return;
        }
        await this.recipes.updateRecipe(current, this.recipeForm.getRawValue());
      } else if (mode === 'ingredient') {
        const id = this.editingId();
        if (id) {
          await this.recipes.updateIngredient(current, id, this.itemText());
        } else {
          await this.recipes.addIngredient(current, this.itemText());
        }
      } else if (mode === 'step') {
        const id = this.editingId();
        if (id) {
          await this.recipes.updateStep(current, id, this.itemText());
        } else {
          await this.recipes.addStep(current, this.itemText());
        }
      }
      this.closeForm();
    } catch {
      this.snackBar.open('Änderung konnte nicht gespeichert werden.', 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteIngredient(id: string): Promise<void> {
    const recipe = this.recipe();
    const item = recipe?.ingredients.find((entry) => entry.id === id);
    if (!recipe || !item || !this.canEdit()) {
      return;
    }
    const confirmed = window.confirm(`Zutat „${item.text}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.recipes.deleteIngredient(recipe, id);
      if (this.editingId() === id) {
        this.closeForm();
      }
    } catch {
      this.snackBar.open('Zutat konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }

  protected async deleteStep(id: string): Promise<void> {
    const recipe = this.recipe();
    const item = recipe?.steps.find((entry) => entry.id === id);
    if (!recipe || !item || !this.canEdit()) {
      return;
    }
    const confirmed = window.confirm(`Schritt „${item.text}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.recipes.deleteStep(recipe, id);
      if (this.editingId() === id) {
        this.closeForm();
      }
    } catch {
      this.snackBar.open('Schritt konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }

  protected async deleteRecipe(): Promise<void> {
    const recipe = this.recipe();
    if (!recipe || !this.canEdit()) {
      return;
    }
    const confirmed = window.confirm(`Rezept „${recipe.title}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.recipes.deleteRecipe(recipe);
      this.snackBar.open('Rezept gelöscht.', 'OK', { duration: 2500 });
      await this.router.navigateByUrl('/rezepte');
    } catch {
      this.snackBar.open('Rezept konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }

  private focusInlineField(): void {
    afterNextRender(
      () => {
        const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          '.rezept-detail__inline-field input, .rezept-detail__inline-field textarea',
        );
        field?.focus();
      },
      { injector: this.injector },
    );
  }

  private async dropItems(
    event: CdkDragDrop<RecipeItem[]>,
    field: 'ingredients' | 'steps',
  ): Promise<void> {
    const recipe = this.recipe();
    if (!recipe || !this.canEdit() || event.previousIndex === event.currentIndex) {
      return;
    }
    const items = [...recipe[field]];
    if (
      event.previousIndex < 0 ||
      event.currentIndex < 0 ||
      event.previousIndex >= items.length ||
      event.currentIndex >= items.length
    ) {
      return;
    }
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    try {
      if (field === 'ingredients') {
        await this.recipes.reorderIngredients(recipe, items);
      } else {
        await this.recipes.reorderSteps(recipe, items);
      }
    } catch {
      this.snackBar.open('Reihenfolge konnte nicht gespeichert werden.', 'OK', { duration: 4000 });
    }
  }
}
