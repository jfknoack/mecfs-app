import { NgClass } from '@angular/common';
import { DestroyRef, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { listIconClass } from '../../../core/lists/list-icons';
import { AppList, ListEntry } from '../../../core/lists/list.model';
import { ListService } from '../../../core/lists/list.service';
import { RecipeService } from '../../../core/recipes/recipe.service';
import {
  formatDateLabel,
  isDateKey,
  isItemChecked,
  isoWeekday,
  newRoutineItemId,
  parseDateKey,
  recurrenceLabel,
  ROUTINE_COLOR_OPTIONS,
  Routine,
  RoutineColor,
  RoutineItem,
  routineColorHex,
  routineIconClass,
  routineOccursOn,
  RoutineRecurrence,
  RoutineVisibility,
  timeLabel,
  toDateKey,
  todayDateKey,
  WEEKDAY_OPTIONS,
  DEFAULT_ROUTINE_COLOR,
} from '../../../core/routines/routine.model';
import { RoutineService } from '../../../core/routines/routine.service';

type RoutineFormMode = 'none' | 'routine' | 'item';
type ItemKind = 'listEntry' | 'recipe';

interface DraftListSource {
  id: string;
  name: string;
  icon: string;
}

interface ItemGroup {
  key: string;
  kind: ItemKind;
  title: string;
  icon: string;
  listId: string;
  items: RoutineItem[];
}

@Component({
  imports: [
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  selector: 'app-routine-detail',
  styleUrl: './routine-detail.scss',
  templateUrl: './routine-detail.html',
})
export class RoutineDetail {
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly lists = inject(ListService);
  private readonly recipes = inject(RecipeService);
  private readonly routines = inject(RoutineService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly iconClass = routineIconClass;
  protected readonly listIconClass = listIconClass;
  protected readonly colorOptions = ROUTINE_COLOR_OPTIONS;
  protected readonly colorHex = routineColorHex;
  protected readonly weekdayOptions = WEEKDAY_OPTIONS;
  protected readonly recurrenceLabel = recurrenceLabel;
  protected readonly timeLabel = timeLabel;
  protected readonly formatDateLabel = formatDateLabel;
  protected readonly isItemChecked = isItemChecked;
  protected readonly routineId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly routine = this.routines.routine;
  protected readonly routineReady = this.routines.routineReady;
  protected readonly listItems = this.lists.lists;
  protected readonly recipeItems = this.recipes.recipes;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly saving = signal(false);
  protected readonly formMode = signal<RoutineFormMode>('none');
  protected readonly itemKind = signal<ItemKind>('listEntry');
  protected readonly draftList = signal<DraftListSource | null>(null);
  protected readonly draftEntries = signal<ListEntry[]>([]);
  protected readonly draftRecipes = signal<{ id: string; title: string }[]>([]);
  protected readonly pickingEntry = signal(false);
  protected readonly pickingRecipe = signal(false);
  protected readonly pickerEntries = signal<ListEntry[]>([]);
  protected readonly loadingEntries = signal(false);

  protected readonly occurrenceDate = computed(() => {
    const requested = this.queryParams()?.get('date') ?? '';
    const routine = this.routine();
    if (requested && isDateKey(requested) && (!routine || routineOccursOn(routine, requested))) {
      return requested;
    }
    const today = todayDateKey();
    if (routine && routineOccursOn(routine, today)) {
      return today;
    }
    return routine?.date ?? today;
  });

  protected readonly itemGroups = computed((): ItemGroup[] => {
    const routine = this.routine();
    if (!routine) {
      return [];
    }
    const lists = this.listItems();
    const groups: ItemGroup[] = [];
    const listGroups = new Map<string, ItemGroup>();
    let recipeGroup: ItemGroup | undefined;

    for (const item of routine.items) {
      if (item.kind === 'recipe') {
        if (!recipeGroup) {
          recipeGroup = {
            key: 'recipe',
            kind: 'recipe',
            title: 'Rezepte',
            icon: 'utensils',
            listId: '',
            items: [],
          };
          groups.push(recipeGroup);
        }
        recipeGroup.items.push(item);
        continue;
      }

      let group = listGroups.get(item.listId);
      if (!group) {
        group = {
          key: item.listId,
          kind: 'listEntry',
          title: item.listName,
          icon: lists.find((list) => list.id === item.listId)?.icon ?? 'list',
          listId: item.listId,
          items: [],
        };
        listGroups.set(item.listId, group);
        groups.push(group);
      }
      group.items.push(item);
    }

    return groups;
  });

  protected readonly availableEntries = computed(() => {
    const used = new Set([
      ...(this.routine()?.items ?? [])
        .filter((item) => item.kind === 'listEntry')
        .map((item) => item.entryId),
      ...this.draftEntries().map((entry) => entry.id),
    ]);
    return this.pickerEntries().filter((entry) => !used.has(entry.id));
  });

  protected readonly availableRecipes = computed(() => {
    const used = new Set([
      ...(this.routine()?.items ?? [])
        .filter((item) => item.kind === 'recipe')
        .map((item) => item.recipeId),
      ...this.draftRecipes().map((recipe) => recipe.id),
    ]);
    return this.recipeItems().filter((recipe) => !used.has(recipe.id));
  });

  protected readonly hasDraftItems = computed(
    () => this.draftEntries().length > 0 || this.draftRecipes().length > 0,
  );

  protected readonly routineForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    date: [parseDateKey(todayDateKey()), Validators.required],
    timeFrom: ['08:00', Validators.required],
    timeTo: [''],
    recurrence: this.formBuilder.nonNullable.control<RoutineRecurrence>('once'),
    weekdays: this.formBuilder.nonNullable.control<number[]>([]),
    visibility: this.formBuilder.nonNullable.control<RoutineVisibility>('private'),
    color: this.formBuilder.nonNullable.control<RoutineColor>(DEFAULT_ROUTINE_COLOR),
  });

  constructor() {
    this.routines.watchRoutine(this.routineId);
    this.destroyRef.onDestroy(() => this.routines.stopWatchingRoutine());
  }

  protected isWeekdaySelected(day: number): boolean {
    return this.routineForm.controls.weekdays.value.includes(day);
  }

  protected toggleWeekday(day: number): void {
    const current = this.routineForm.controls.weekdays.value;
    const next = current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b);
    this.routineForm.controls.weekdays.setValue(next);
  }

  protected onRecurrenceChange(): void {
    if (this.routineForm.controls.recurrence.value !== 'weekly') {
      this.routineForm.controls.weekdays.setValue([]);
      return;
    }
    if (!this.routineForm.controls.weekdays.value.length) {
      const date = this.routineForm.controls.date.value ?? parseDateKey(todayDateKey());
      this.routineForm.controls.weekdays.setValue([isoWeekday(date)]);
    }
  }

  protected openRoutineForm(): void {
    const routine = this.routine();
    if (!routine || !this.isAdmin()) {
      return;
    }
    this.resetItemDraft();
    this.routineForm.reset({
      title: routine.title,
      date: parseDateKey(routine.date),
      timeFrom: routine.timeFrom,
      timeTo: routine.timeTo,
      recurrence: routine.recurrence,
      weekdays: [...routine.weekdays],
      visibility: routine.visibility,
      color: routine.color,
    });
    this.formMode.set('routine');
  }

  protected selectColor(color: RoutineColor): void {
    this.routineForm.controls.color.setValue(color);
  }

  protected openItemForm(): void {
    if (!this.isAdmin()) {
      return;
    }
    this.resetItemDraft();
    this.itemKind.set('listEntry');
    this.formMode.set('item');
  }

  protected openGroupForm(group: ItemGroup): void {
    if (!this.isAdmin()) {
      return;
    }
    this.resetItemDraft();
    this.itemKind.set(group.kind);
    this.formMode.set('item');
    if (group.kind === 'listEntry') {
      void this.onListPicked(group.listId, true);
      return;
    }
    this.pickingRecipe.set(true);
  }

  protected closeForm(): void {
    this.resetItemDraft();
    this.formMode.set('none');
  }

  protected onItemKindChange(kind: ItemKind): void {
    this.itemKind.set(kind);
    this.draftList.set(null);
    this.draftEntries.set([]);
    this.draftRecipes.set([]);
    this.pickingEntry.set(false);
    this.pickingRecipe.set(false);
    this.pickerEntries.set([]);
  }

  protected async onListPicked(listId: string, openPicker = false): Promise<void> {
    const list = this.listItems().find((item) => item.id === listId);
    this.draftList.set(list ? toDraftList(list) : null);
    this.draftEntries.set([]);
    this.pickingEntry.set(false);
    if (!list) {
      this.pickerEntries.set([]);
      return;
    }
    this.loadingEntries.set(true);
    try {
      this.pickerEntries.set(await this.lists.loadEntries(list.id));
      this.pickingEntry.set(openPicker && this.availableEntries().length > 0);
    } catch {
      this.pickerEntries.set([]);
      this.snackBar.open('Listeneinträge konnten nicht geladen werden.', 'OK', { duration: 4000 });
    } finally {
      this.loadingEntries.set(false);
    }
  }

  protected startPickingEntry(): void {
    if (!this.availableEntries().length) {
      return;
    }
    this.pickingEntry.set(true);
  }

  protected addDraftEntry(entryId: string): void {
    const entry = this.availableEntries().find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    this.draftEntries.update((items) => [...items, entry]);
    this.pickingEntry.set(false);
  }

  protected removeDraftEntry(entryId: string): void {
    this.draftEntries.update((items) => items.filter((item) => item.id !== entryId));
  }

  protected startPickingRecipe(): void {
    if (!this.availableRecipes().length) {
      return;
    }
    this.pickingRecipe.set(true);
  }

  protected addDraftRecipe(recipeId: string): void {
    const recipe = this.availableRecipes().find((item) => item.id === recipeId);
    if (!recipe) {
      return;
    }
    this.draftRecipes.update((items) => [...items, { id: recipe.id, title: recipe.title }]);
    this.pickingRecipe.set(false);
  }

  protected removeDraftRecipe(recipeId: string): void {
    this.draftRecipes.update((items) => items.filter((item) => item.id !== recipeId));
  }

  protected async saveForm(): Promise<void> {
    const routine = this.routine();
    if (!routine || !this.isAdmin()) {
      return;
    }

    this.saving.set(true);
    try {
      if (this.formMode() === 'routine') {
        if (this.routineForm.invalid) {
          this.routineForm.markAllAsTouched();
          this.saving.set(false);
          return;
        }
        const value = this.routineForm.getRawValue();
        await this.routines.updateRoutine(routine, {
          ...value,
          date: toDateKey(value.date),
        });
      } else if (this.formMode() === 'item') {
        await this.saveDraftItems(routine);
      }
      this.closeForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Änderung konnte nicht gespeichert werden.';
      this.snackBar.open(message, 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleChecked(itemId: string, checked: boolean): Promise<void> {
    const routine = this.routine();
    if (!routine) {
      return;
    }
    try {
      await this.routines.setItemChecked(routine, this.occurrenceDate(), itemId, checked);
    } catch {
      this.snackBar.open('Status konnte nicht gespeichert werden.', 'OK', { duration: 4000 });
    }
  }

  protected async deleteItem(itemId: string): Promise<void> {
    const routine = this.routine();
    const item = routine?.items.find((entry) => entry.id === itemId);
    if (!routine || !item || !this.isAdmin()) {
      return;
    }
    const confirmed = window.confirm(`„${item.text}" wirklich entfernen?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.routines.deleteItem(routine, itemId);
    } catch {
      this.snackBar.open('Punkt konnte nicht entfernt werden.', 'OK', { duration: 4000 });
    }
  }

  protected async deleteRoutine(): Promise<void> {
    const routine = this.routine();
    if (!routine || !this.isAdmin()) {
      return;
    }
    const confirmed = window.confirm(`Routine „${routine.title}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.routines.deleteRoutine(routine);
      this.snackBar.open('Routine gelöscht.', 'OK', { duration: 2500 });
      await this.router.navigateByUrl('/routinen');
    } catch {
      this.snackBar.open('Routine konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }

  private async saveDraftItems(routine: Routine): Promise<void> {
    const list = this.draftList();
    const items: RoutineItem[] = [
      ...this.draftEntries().map((entry) => ({
        id: newRoutineItemId(),
        kind: 'listEntry' as const,
        listId: list?.id ?? '',
        listName: list?.name ?? '',
        entryId: entry.id,
        recipeId: '',
        text: entry.text,
      })),
      ...this.draftRecipes().map((recipe) => ({
        id: newRoutineItemId(),
        kind: 'recipe' as const,
        listId: '',
        listName: '',
        entryId: '',
        recipeId: recipe.id,
        text: recipe.title,
      })),
    ];
    await this.routines.addItems(routine, items);
  }

  private resetItemDraft(): void {
    this.draftList.set(null);
    this.draftEntries.set([]);
    this.draftRecipes.set([]);
    this.pickingEntry.set(false);
    this.pickingRecipe.set(false);
    this.pickerEntries.set([]);
  }
}

function toDraftList(list: AppList): DraftListSource {
  return {
    id: list.id,
    name: list.name,
    icon: list.icon,
  };
}
