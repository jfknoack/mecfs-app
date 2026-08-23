import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { FullCalendarModule, CalendarOptions } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import deLocale from 'fullcalendar/locales/de';
import themePlugin from '@fullcalendar/angular/themes/monarch';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import { Auth } from '../../core/auth/auth';
import {
  AppCalendarEvent,
  CalendarApiError,
  CalendarEventInput,
  emptyCalendarEventInput,
  EVENT_RECURRENCE_OPTIONS,
  EVENT_REMINDER_OPTIONS,
  eventTimesValid,
  EventRecurrence,
  EventReminder,
  EventTransparency,
  EventVisibility,
  toCalendarEventInput,
} from '../../core/calendar/google-calendar.model';
import { GoogleCalendarService } from '../../core/calendar/google-calendar.service';
import { listIconClass } from '../../core/lists/list-icons';
import { ListService } from '../../core/lists/list.service';
import {
  expandRoutineEvents,
  formatDateLabel,
  GOOGLE_CALENDAR_EVENT_COLOR,
  isItemChecked,
  recurrenceLabel,
  Routine,
  RoutineItem,
  routineColorHex,
  timeLabel,
} from '../../core/routines/routine.model';
import { RoutineService } from '../../core/routines/routine.service';
import { Theme } from '../../core/theme/theme';

type KalenderPopover =
  | { kind: 'event' }
  | { kind: 'routine'; routineId: string; date: string };

interface RoutineItemGroup {
  key: string;
  kind: 'listEntry' | 'recipe';
  title: string;
  icon: string;
  items: RoutineItem[];
}

@Component({
  imports: [
    NgClass,
    ReactiveFormsModule,
    RouterLink,
    FullCalendarModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  host: {
    '(document:keydown.escape)': 'onDocumentEscape()',
  },
  selector: 'app-kalender',
  styleUrl: './kalender.scss',
  templateUrl: './kalender.html',
})
export class Kalender {
  private readonly auth = inject(Auth);
  private readonly formBuilder = inject(FormBuilder);
  private readonly google = inject(GoogleCalendarService);
  private readonly lists = inject(ListService);
  private readonly routines = inject(RoutineService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly theme = inject(Theme);

  protected readonly title = 'Kalender';
  protected readonly iconClass = listIconClass;
  protected readonly calendarConfigured = this.google.isConfigured();
  protected readonly hasCalendarAccess = this.auth.hasCalendarAccess;
  protected readonly connecting = signal(false);
  protected readonly saving = signal(false);
  protected readonly popover = signal<KalenderPopover | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingSeriesInstance = signal(false);
  protected readonly formatDateLabel = formatDateLabel;
  protected readonly recurrenceLabel = recurrenceLabel;
  protected readonly timeLabel = timeLabel;
  protected readonly isItemChecked = isItemChecked;
  protected readonly recurrenceOptions = EVENT_RECURRENCE_OPTIONS;
  protected readonly reminderOptions = EVENT_REMINDER_OPTIONS;

  protected readonly form = this.formBuilder.nonNullable.group({
    title: ['', Validators.maxLength(1024)],
    description: ['', Validators.maxLength(8192)],
    location: ['', Validators.maxLength(1024)],
    allDay: false,
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    startTime: ['10:00', Validators.required],
    endTime: ['11:00', Validators.required],
    recurrence: this.formBuilder.nonNullable.control<EventRecurrence>('none'),
    visibility: this.formBuilder.nonNullable.control<EventVisibility>('default'),
    transparency: this.formBuilder.nonNullable.control<EventTransparency>('opaque'),
    reminder: this.formBuilder.nonNullable.control<EventReminder>('default'),
  });

  protected readonly popoverRoutine = computed(() => {
    const panel = this.popover();
    if (panel?.kind !== 'routine') {
      return null;
    }
    return this.routines.routines().find((routine) => routine.id === panel.routineId) ?? null;
  });

  protected readonly popoverRoutineDate = computed(() => {
    const panel = this.popover();
    return panel?.kind === 'routine' ? panel.date : '';
  });

  protected readonly popoverTitle = computed(() => {
    const panel = this.popover();
    if (panel?.kind === 'routine') {
      return this.popoverRoutine()?.title ?? 'Routine';
    }
    if (panel?.kind === 'event') {
      return this.editingId() ? 'Termin bearbeiten' : 'Termin anlegen';
    }
    return '';
  });

  protected readonly popoverAccent = computed(() => {
    const panel = this.popover();
    if (panel?.kind === 'routine') {
      const routine = this.popoverRoutine();
      return routine ? routineColorHex(routine.color) : GOOGLE_CALENDAR_EVENT_COLOR;
    }
    return GOOGLE_CALENDAR_EVENT_COLOR;
  });

  protected readonly routineItemGroups = computed((): RoutineItemGroup[] => {
    const routine = this.popoverRoutine();
    if (!routine) {
      return [];
    }
    return groupRoutineItems(routine, this.lists.lists());
  });

  protected readonly calendarOptions = computed<CalendarOptions>(() => {
    this.routines.routines();
    this.google.revision();
    this.hasCalendarAccess();
    return {
      plugins: [themePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      locale: deLocale,
      height: 'auto',
      colorScheme: this.theme.mode(),
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      },
      events: (info, success) => {
        const routineEvents = expandRoutineEvents(
          this.routines.routines(),
          info.start,
          info.end,
        ).map((item) => ({
          id: item.id,
          title: item.title,
          start: item.start,
          end: item.end ?? undefined,
          color: routineColorHex(item.color),
          contrastColor: '#fff',
          className: eventClassName(
            'kalender__event',
            'kalender__event--routine',
            item.done ? 'kalender__event--done' : '',
          ),
          extendedProps: { source: 'routine', routineId: item.routineId, date: item.date },
        }));

        void this.google
          .listEvents(info.start, info.end)
          .then((items) => {
            success([
              ...routineEvents,
              ...items.map((item) => ({
                id: item.id,
                title: item.title,
                start: item.start,
                end: item.end,
                allDay: item.allDay,
                color: GOOGLE_CALENDAR_EVENT_COLOR,
                contrastColor: '#fff',
                className: eventClassName('kalender__event', 'kalender__event--google'),
                extendedProps: {
                  source: 'google',
                  event: item,
                },
              })),
            ]);
          })
          .catch((error) => {
            this.snackBar.open(calendarErrorMessage(error), 'OK', { duration: 4000 });
            success(routineEvents);
          });
      },
      dateClick: (info) => {
        this.openCreate(info.date, info.allDay);
      },
      eventClick: (info) => {
        const source = String(info.event.extendedProps['source'] ?? '');
        info.jsEvent.preventDefault();
        if (source === 'google') {
          const fallback = info.event.extendedProps['event'] as AppCalendarEvent | undefined;
          this.openEdit(
            info.event.id,
            fallback ? toCalendarEventInput(fallback) : eventClickFallback(info.event),
          );
          return;
        }
        const routineId = String(info.event.extendedProps['routineId'] ?? '');
        const date = String(info.event.extendedProps['date'] ?? info.event.startStr.slice(0, 10));
        if (!routineId) {
          return;
        }
        this.openRoutine(routineId, date);
      },
    };
  });

  protected onDocumentEscape(): void {
    if (this.popover()) {
      this.closePopover();
    }
  }

  protected async connect(): Promise<void> {
    this.connecting.set(true);
    try {
      await this.auth.ensureCalendarAccess();
      this.google.bump();
    } catch (error) {
      this.snackBar.open(calendarErrorMessage(error), 'OK', { duration: 4000 });
    } finally {
      this.connecting.set(false);
    }
  }

  protected openCreate(date = new Date(), allDay = true): void {
    if (!this.calendarConfigured || !this.hasCalendarAccess()) {
      return;
    }
    this.editingId.set(null);
    this.editingSeriesInstance.set(false);
    this.form.controls.recurrence.enable();
    this.form.reset(emptyCalendarEventInput(toDateInput(date), allDay));
    if (!allDay) {
      this.form.patchValue({
        startTime: toTimeInput(date),
        endTime: toTimeInput(addHours(date, 1)),
      });
    }
    this.popover.set({ kind: 'event' });
  }

  protected openEdit(id: string, input: CalendarEventInput): void {
    this.editingId.set(id);
    this.editingSeriesInstance.set(false);
    this.form.controls.recurrence.enable();
    this.form.reset(input);
    this.popover.set({ kind: 'event' });
    void this.loadGoogleEvent(id);
  }

  protected openRoutine(routineId: string, date: string): void {
    this.editingId.set(null);
    this.editingSeriesInstance.set(false);
    this.popover.set({ kind: 'routine', routineId, date });
  }

  protected closePopover(): void {
    this.popover.set(null);
    this.editingId.set(null);
    this.editingSeriesInstance.set(false);
  }

  protected onAllDayChange(): void {
    if (this.form.controls.allDay.value) {
      return;
    }
    if (
      this.form.controls.startTime.value === '00:00' &&
      this.form.controls.endTime.value === '00:00'
    ) {
      this.form.patchValue({ startTime: '10:00', endTime: '11:00' });
    }
  }

  private async loadGoogleEvent(id: string): Promise<void> {
    try {
      const event = await this.google.getEvent(id);
      if (this.editingId() !== id) {
        return;
      }
      this.editingSeriesInstance.set(Boolean(event.recurringEventId));
      this.form.reset(toCalendarEventInput(event));
      if (event.recurringEventId) {
        this.form.controls.recurrence.disable();
      } else {
        this.form.controls.recurrence.enable();
      }
    } catch {
      // Keep the values already mapped from the calendar list.
    }
  }

  protected async saveEvent(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!eventTimesValid(value)) {
      this.snackBar.open('Das Ende muss nach dem Beginn liegen.', 'OK', { duration: 3000 });
      return;
    }

    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) {
        await this.google.updateEvent(id, value, {
          includeRecurrence: !this.editingSeriesInstance(),
          isUpdate: true,
        });
      } else {
        await this.google.createEvent(value);
      }
      this.closePopover();
    } catch (error) {
      this.snackBar.open(calendarErrorMessage(error), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteEvent(): Promise<void> {
    const id = this.editingId();
    const title = this.form.controls.title.value.trim() || 'Termin';
    if (!id) {
      return;
    }
    const confirmed = window.confirm(`Termin „${title}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }
    this.saving.set(true);
    try {
      await this.google.deleteEvent(id);
      this.closePopover();
    } catch (error) {
      this.snackBar.open(calendarErrorMessage(error), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleRoutineItem(itemId: string, checked: boolean): Promise<void> {
    const routine = this.popoverRoutine();
    const date = this.popoverRoutineDate();
    if (!routine || !date) {
      return;
    }
    try {
      await this.routines.setItemChecked(routine, date, itemId, checked);
    } catch {
      this.snackBar.open('Status konnte nicht gespeichert werden.', 'OK', { duration: 4000 });
    }
  }
}

function groupRoutineItems(
  routine: Routine,
  lists: { id: string; icon: string }[],
): RoutineItemGroup[] {
  const groups: RoutineItemGroup[] = [];
  const listGroups = new Map<string, RoutineItemGroup>();
  let recipeGroup: RoutineItemGroup | undefined;

  for (const item of routine.items) {
    if (item.kind === 'recipe') {
      if (!recipeGroup) {
        recipeGroup = {
          key: 'recipe',
          kind: 'recipe',
          title: 'Rezepte',
          icon: 'utensils',
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
        items: [],
      };
      listGroups.set(item.listId, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

function eventClassName(...parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

function eventClickFallback(event: {
  title: string;
  allDay: boolean;
  start: Date | null;
  end: Date | null;
}): CalendarEventInput {
  const start = event.start ?? new Date();
  const end = event.end ?? start;
  const input = emptyCalendarEventInput(toDateInput(start), event.allDay);
  const title = event.title === '(ohne Titel)' ? '' : event.title;
  if (event.allDay) {
    const inclusiveEnd = new Date(end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    return {
      ...input,
      title,
      startDate: toDateInput(start),
      endDate: toDateInput(inclusiveEnd < start ? start : inclusiveEnd),
    };
  }
  return {
    ...input,
    title,
    startDate: toDateInput(start),
    endDate: toDateInput(end),
    startTime: toTimeInput(start),
    endTime: toTimeInput(end),
  };
}

function toDateInput(value: Date | null): string {
  const date = value ?? new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInput(value: Date | null): string {
  const date = value ?? new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addHours(value: Date, hours: number): Date {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function calendarErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: string }).code)
      : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google-Kalender-Verbindung wurde abgebrochen.';
  }
  if (error instanceof CalendarApiError || error instanceof Error) {
    return error.message;
  }
  return 'Google Kalender ist gerade nicht erreichbar.';
}
