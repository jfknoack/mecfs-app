import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { afterNextRender, DestroyRef, Component, computed, inject, Injector, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { listIconClass } from '../../../core/lists/list-icons';
import { ListVisibility } from '../../../core/lists/list.model';
import { DuplicateListNameError, ListService } from '../../../core/lists/list.service';

type ListFormMode = 'none' | 'list' | 'entry';

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
  selector: 'app-listen-detail',
  styleUrl: './listen-detail.scss',
  templateUrl: './listen-detail.html',
})
export class ListenDetail {
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly lists = inject(ListService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly iconClass = listIconClass;
  protected readonly entryText = signal('');
  protected readonly saving = signal(false);
  protected readonly formMode = signal<ListFormMode>('none');
  protected readonly editingId = signal<string | null>(null);
  protected readonly listId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly list = computed(() => this.lists.listById(this.listId));
  protected readonly entries = this.lists.entries;
  protected readonly isAdmin = this.auth.canManageHousehold;
  protected readonly listsReady = this.lists.listsReady;

  protected readonly listForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    visibility: this.formBuilder.nonNullable.control<ListVisibility>('private'),
  });

  constructor() {
    this.lists.watchEntries(this.listId);
    this.destroyRef.onDestroy(() => this.lists.stopWatchingEntries());
  }

  protected isAdding(): boolean {
    return this.formMode() === 'entry' && this.editingId() === null;
  }

  protected isEditing(id: string): boolean {
    return this.formMode() === 'entry' && this.editingId() === id;
  }

  protected isEditingList(): boolean {
    return this.formMode() === 'list';
  }

  protected canEditEntry(_authorUid?: string): boolean {
    return this.isAdmin();
  }

  protected canDeleteEntry(_authorUid?: string): boolean {
    return this.isAdmin();
  }

  protected openListForm(): void {
    const list = this.list();
    if (!list || !this.isAdmin()) {
      return;
    }
    this.listForm.reset({
      name: list.name,
      visibility: list.visibility,
    });
    this.formMode.set('list');
    this.editingId.set(null);
    this.entryText.set('');
    this.focusInlineField();
  }

  protected openAdd(): void {
    if (!this.isAdmin()) {
      return;
    }
    this.formMode.set('entry');
    this.editingId.set(null);
    this.entryText.set('');
    this.focusInlineField();
  }

  protected openEdit(id: string): void {
    const entry = this.entries().find((item) => item.id === id);
    if (!entry || !this.canEditEntry(entry.authorUid)) {
      return;
    }
    this.formMode.set('entry');
    this.editingId.set(id);
    this.entryText.set(entry.text);
    this.focusInlineField();
  }

  protected closeForm(): void {
    this.formMode.set('none');
    this.editingId.set(null);
    this.entryText.set('');
  }

  protected onEntryInput(event: Event): void {
    this.entryText.set((event.target as HTMLInputElement).value);
  }

  protected async saveForm(): Promise<void> {
    const list = this.list();
    if (!list || !this.isAdmin()) {
      return;
    }

    this.saving.set(true);
    try {
      if (this.formMode() === 'list') {
        if (this.listForm.invalid) {
          this.listForm.markAllAsTouched();
          this.saving.set(false);
          return;
        }
        await this.lists.updateList(list, this.listForm.getRawValue());
      } else {
        const id = this.editingId();
        if (id) {
          const entry = this.entries().find((item) => item.id === id);
          if (!entry || !this.canEditEntry(entry.authorUid)) {
            return;
          }
          await this.lists.updateEntry(list, entry, this.entryText());
        } else {
          await this.lists.addEntry(list, this.entryText());
        }
      }
      this.closeForm();
    } catch (error) {
      this.snackBar.open(
        error instanceof DuplicateListNameError
          ? error.message
          : 'Änderung konnte nicht gespeichert werden.',
        'OK',
        { duration: 4000 },
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteEntry(entryId: string, authorUid: string): Promise<void> {
    const list = this.list();
    const entry = this.entries().find((item) => item.id === entryId);
    if (!list || !entry || !this.canDeleteEntry(authorUid)) {
      return;
    }
    const confirmed = window.confirm(`Eintrag „${entry.text}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    try {
      await this.lists.deleteEntry(list, entry);
      if (this.editingId() === entryId) {
        this.closeForm();
      }
    } catch {
      this.snackBar.open('Eintrag konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }

  protected async deleteList(): Promise<void> {
    const list = this.list();
    if (!list || !this.isAdmin()) {
      return;
    }

    const confirmed = window.confirm(`Listentyp "${list.name}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    try {
      await this.lists.deleteList(list);
      this.snackBar.open('Liste gelöscht.', 'OK', { duration: 2500 });
      await this.router.navigateByUrl('/listen');
    } catch {
      this.snackBar.open('Liste konnte nicht gelöscht werden.', 'OK', { duration: 4000 });
    }
  }

  private focusInlineField(): void {
    afterNextRender(
      () => {
        const field = document.querySelector<HTMLInputElement>(
          '.listen-detail__inline-field input',
        );
        field?.focus();
      },
      { injector: this.injector },
    );
  }
}
