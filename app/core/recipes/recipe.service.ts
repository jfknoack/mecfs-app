import { effect, Injectable, signal, untracked } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { Auth } from '../auth/auth';
import { firebaseDb, isFirebaseConfigured } from '../firebase/firebase-app';
import {
  CreateRecipeInput,
  newRecipeItemId,
  Recipe,
  RecipeItem,
  UpdateRecipeInput,
} from './recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly recipesState = signal<Recipe[]>([]);
  private readonly recipeState = signal<Recipe | null>(null);
  private readonly recipesReadyState = signal(false);
  private readonly recipeReadyState = signal(false);
  private recipesUnsubs: Unsubscribe[] = [];
  private recipeUnsub: Unsubscribe | null = null;

  readonly recipes = this.recipesState.asReadonly();
  readonly recipesReady = this.recipesReadyState.asReadonly();
  readonly recipe = this.recipeState.asReadonly();
  readonly recipeReady = this.recipeReadyState.asReadonly();

  constructor(private readonly auth: Auth) {
    effect(() => {
      const uid = this.auth.uid();
      untracked(() => {
        if (!isFirebaseConfigured() || !uid) {
          this.stopWatchingRecipes();
          this.recipesState.set([]);
          this.recipesReadyState.set(true);
          return;
        }
        this.watchRecipes();
      });
    });
  }

  watchRecipes(): void {
    this.stopWatchingRecipes();
    const uid = this.auth.uid();
    if (!isFirebaseConfigured() || !uid) {
      this.recipesState.set([]);
      this.recipesReadyState.set(true);
      return;
    }

    this.recipesUnsubs = [
      onSnapshot(
        collection(firebaseDb(), 'recipes'),
        (snapshot) => {
          this.recipesState.set(
            [...toRecipeMap(snapshot.docs).values()].sort((a, b) =>
              a.title.localeCompare(b.title, 'de'),
            ),
          );
          this.recipesReadyState.set(true);
        },
        () => this.recipesReadyState.set(true),
      ),
    ];
  }

  stopWatchingRecipes(): void {
    for (const unsub of this.recipesUnsubs) {
      unsub();
    }
    this.recipesUnsubs = [];
  }

  watchRecipe(id: string): void {
    this.stopWatchingRecipe();
    if (!isFirebaseConfigured() || !id) {
      this.recipeReadyState.set(true);
      return;
    }

    this.recipeUnsub = onSnapshot(
      doc(firebaseDb(), 'recipes', id),
      (snapshot) => {
        this.recipeState.set(snapshot.exists() ? toRecipe(snapshot) : null);
        this.recipeReadyState.set(true);
      },
      () => {
        this.recipeState.set(null);
        this.recipeReadyState.set(true);
      },
    );
  }

  stopWatchingRecipe(): void {
    this.recipeUnsub?.();
    this.recipeUnsub = null;
    this.recipeState.set(null);
    this.recipeReadyState.set(false);
  }

  canEdit(_recipe: Recipe): boolean {
    return this.auth.isAdmin();
  }

  canDelete(recipe: Recipe): boolean {
    return this.canEdit(recipe);
  }

  async createRecipe(input: CreateRecipeInput): Promise<string> {
    const uid = this.requireAdmin();
    const title = normalizeText(input.title);
    const description = input.description.trim();
    if (!title) {
      throw new Error('Bitte einen Titel angeben.');
    }

    const recipeRef = doc(collection(firebaseDb(), 'recipes'));
    await setDoc(recipeRef, {
      title,
      description,
      visibility: input.visibility,
      authorUid: uid,
      authorName: this.auth.username() ?? 'Unbekannt',
      ingredients: [],
      steps: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return recipeRef.id;
  }

  async updateRecipe(recipe: Recipe, input: UpdateRecipeInput): Promise<void> {
    this.requireEdit(recipe);
    const title = normalizeText(input.title);
    const description = input.description.trim();
    if (!title) {
      throw new Error('Bitte einen Titel angeben.');
    }

    await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
      title,
      description,
      visibility: input.visibility,
      updatedAt: serverTimestamp(),
    });
  }

  async addIngredient(recipe: Recipe, text: string): Promise<void> {
    this.requireEdit(recipe);
    const item = toItem(text, 80);
    const current = this.currentRecipe(recipe);
    await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
      ingredients: [...current.ingredients, item],
      updatedAt: serverTimestamp(),
    });
  }

  async updateIngredient(recipe: Recipe, itemId: string, text: string): Promise<void> {
    this.requireEdit(recipe);
    const item = toItem(text, 80);
    const current = this.currentRecipe(recipe);
    await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
      ingredients: current.ingredients.map((entry) =>
        entry.id === itemId ? { ...entry, text: item.text } : entry,
      ),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteIngredient(recipe: Recipe, itemId: string): Promise<void> {
    this.requireEdit(recipe);
    const current = this.currentRecipe(recipe);
    await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
      ingredients: current.ingredients.filter((entry) => entry.id !== itemId),
      updatedAt: serverTimestamp(),
    });
  }

  async reorderIngredients(recipe: Recipe, items: RecipeItem[]): Promise<void> {
    await this.reorderItems(recipe, 'ingredients', items);
  }

  async addStep(recipe: Recipe, text: string): Promise<void> {
    this.requireEdit(recipe);
    const item = toItem(text, 500, true);
    const current = this.currentRecipe(recipe);
    await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
      steps: [...current.steps, item],
      updatedAt: serverTimestamp(),
    });
  }

  async updateStep(recipe: Recipe, itemId: string, text: string): Promise<void> {
    this.requireEdit(recipe);
    const item = toItem(text, 500, true);
    const current = this.currentRecipe(recipe);
    await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
      steps: current.steps.map((entry) =>
        entry.id === itemId ? { ...entry, text: item.text } : entry,
      ),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteStep(recipe: Recipe, itemId: string): Promise<void> {
    this.requireEdit(recipe);
    const current = this.currentRecipe(recipe);
    await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
      steps: current.steps.filter((entry) => entry.id !== itemId),
      updatedAt: serverTimestamp(),
    });
  }

  async reorderSteps(recipe: Recipe, items: RecipeItem[]): Promise<void> {
    await this.reorderItems(recipe, 'steps', items);
  }

  async deleteRecipe(recipe: Recipe): Promise<void> {
    this.requireEdit(recipe);
    await deleteDoc(doc(firebaseDb(), 'recipes', recipe.id));
  }

  private currentRecipe(recipe: Recipe): Recipe {
    const live = this.recipeState();
    return live?.id === recipe.id ? live : recipe;
  }

  private async reorderItems(
    recipe: Recipe,
    field: 'ingredients' | 'steps',
    items: RecipeItem[],
  ): Promise<void> {
    this.requireEdit(recipe);
    const stored = toStoredItems(items);
    const current = this.currentRecipe(recipe);
    const previous = current[field];
    this.recipeState.set({ ...current, [field]: stored });
    try {
      await updateDoc(doc(firebaseDb(), 'recipes', recipe.id), {
        [field]: stored,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const live = this.currentRecipe(recipe);
      if (live.id === recipe.id) {
        this.recipeState.set({ ...live, [field]: previous });
      }
      throw error;
    }
  }

  private requireUid(): string {
    const uid = this.auth.uid();
    if (!uid) {
      throw new Error('Bitte erneut anmelden, um Rezepte zu speichern.');
    }
    return uid;
  }

  private requireAdmin(): string {
    const uid = this.requireUid();
    if (!this.auth.isAdmin()) {
      throw new Error('Nur Admins können Rezepte pflegen.');
    }
    return uid;
  }

  private requireEdit(recipe: Recipe): void {
    this.requireAdmin();
    if (!this.canEdit(recipe)) {
      throw new Error('Dieses Rezept kann nicht bearbeitet werden.');
    }
  }
}

function toRecipeMap(docs: QueryDocumentSnapshot<DocumentData>[]): Map<string, Recipe> {
  return new Map(docs.map((item) => [item.id, toRecipe(item)]));
}

function toRecipe(snapshot: { id: string; data: () => DocumentData | undefined }): Recipe {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    title: String(data['title'] ?? ''),
    description: String(data['description'] ?? ''),
    visibility: data['visibility'] === 'public' ? 'public' : 'private',
    authorUid: String(data['authorUid'] ?? ''),
    authorName: String(data['authorName'] ?? ''),
    ingredients: toItems(data['ingredients']),
    steps: toItems(data['steps']),
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

function toItems(value: unknown): RecipeItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const item = entry as { id?: unknown; text?: unknown };
      const text = String(item.text ?? '').trim();
      if (!text) {
        return null;
      }
      return {
        id: String(item.id ?? newRecipeItemId()),
        text,
      };
    })
    .filter((item): item is RecipeItem => item !== null);
}

function toItem(text: string, maxLength: number, multiline = false): RecipeItem {
  const value = multiline ? text.trim() : normalizeText(text);
  if (!value || value.length > maxLength) {
    throw new Error('Bitte einen gültigen Text angeben.');
  }
  return { id: newRecipeItemId(), text: value };
}

function toStoredItems(items: RecipeItem[]): RecipeItem[] {
  return items.map((item) => ({ id: item.id, text: item.text }));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

