export type RecipeVisibility = 'private' | 'public';

export interface RecipeItem {
  id: string;
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  visibility: RecipeVisibility;
  authorUid: string;
  authorName: string;
  ingredients: RecipeItem[];
  steps: RecipeItem[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateRecipeInput {
  title: string;
  description: string;
  visibility: RecipeVisibility;
}

export interface UpdateRecipeInput {
  title: string;
  description: string;
  visibility: RecipeVisibility;
}

export function recipeIconClass(iconName: string): string {
  return `fa-solid fa-${iconName}`;
}

export function newRecipeItemId(): string {
  return crypto.randomUUID();
}
