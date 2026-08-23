import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import {
  AppCalendarEvent,
  CalendarApiError,
  calendarEventOnDate,
  calendarEventTimeLabel,
} from '../../core/calendar/google-calendar.model';
import { GoogleCalendarService } from '../../core/calendar/google-calendar.service';
import { listIconClass } from '../../core/lists/list-icons';
import { ListService } from '../../core/lists/list.service';
import {
  addDateKeyDays,
  formatDateLabel,
  isItemChecked,
  occurrenceProgress,
  OccurrenceProgress,
  parseDateKey,
  Routine,
  RoutineItem,
  routineColorHex,
  routineIconClass,
  routineOccursOn,
  timeLabel,
  todayDateKey,
} from '../../core/routines/routine.model';
import { RoutineService } from '../../core/routines/routine.service';

interface ItemGroup {
  key: string;
  kind: 'listEntry' | 'recipe';
  title: string;
  icon: string;
  items: RoutineItem[];
}

interface RoutineCard {
  id: string;
  date: string;
  title: string;
  time: string;
  progress: OccurrenceProgress;
  routine: Routine;
  groups: ItemGroup[];
}

interface TimelineItem {
  kind: 'routine' | 'event';
  sort: string;
  card?: RoutineCard;
  event?: AppCalendarEvent;
}

@Component({
  imports: [
    NgClass,
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatSnackBarModule,
  ],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly auth = inject(Auth);
  private readonly google = inject(GoogleCalendarService);
  private readonly lists = inject(ListService);
  private readonly routines = inject(RoutineService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly title = 'Dashboard';
  protected readonly iconClass = routineIconClass;
  protected readonly listIconClass = listIconClass;
  protected readonly isItemChecked = isItemChecked;
  protected readonly calendarEventTimeLabel = calendarEventTimeLabel;
  protected readonly calendarConfigured = this.google.isConfigured;
  protected readonly hasCalendarAccess = this.auth.hasCalendarAccess;
  protected readonly connecting = signal(false);
  protected readonly calendarEvents = signal<AppCalendarEvent[]>([]);
  protected readonly showGoogleEvents = signal(true);
  protected readonly hiddenRoutineIds = signal(new Set<string>());
  protected readonly filtersOpen = signal(true);
  protected readonly colorHex = routineColorHex;
  protected readonly filterRoutines = computed(() => this.routines.routines());
  protected readonly filterSummary = computed(() => {
    const hidden = this.hiddenRoutineIds().size;
    const google = this.showGoogleEvents() ? 'Google an' : 'Google aus';
    if (!hidden) {
      return google;
    }
    return `${hidden} ${hidden === 1 ? 'Routine' : 'Routinen'} ausgeblendet · ${google}`;
  });

  protected readonly todayKey = todayDateKey();
  protected readonly tomorrowKey = addDateKeyDays(this.todayKey, 1);
  protected readonly todayLabel = formatDateLabel(this.todayKey);
  protected readonly tomorrowLabel = formatDateLabel(this.tomorrowKey);

  protected readonly todayItems = computed(() => this.timelineFor(this.todayKey));
  protected readonly tomorrowItems = computed(() => this.timelineFor(this.tomorrowKey));

  constructor() {
    effect(() => {
      this.google.revision();
      this.google.isConfigured();
      const access = this.hasCalendarAccess();
      untracked(() => {
        void this.loadCalendarEvents(access);
      });
    });
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected isRoutineVisible(routineId: string): boolean {
    return !this.hiddenRoutineIds().has(routineId);
  }

  protected toggleRoutineFilter(routineId: string, visible: boolean): void {
    this.hiddenRoutineIds.update((current) => {
      const next = new Set(current);
      if (visible) {
        next.delete(routineId);
      } else {
        next.add(routineId);
      }
      return next;
    });
  }

  protected toggleGoogleFilter(visible: boolean): void {
    this.showGoogleEvents.set(visible);
  }

  protected async connectCalendar(): Promise<void> {
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

  protected async toggleChecked(card: RoutineCard, itemId: string, checked: boolean): Promise<void> {
    try {
      await this.routines.setItemChecked(card.routine, card.date, itemId, checked);
    } catch {
      this.snackBar.open('Status konnte nicht gespeichert werden.', 'OK', { duration: 4000 });
    }
  }

  private timelineFor(dateKey: string): TimelineItem[] {
    const lists = this.lists.lists();
    const items: TimelineItem[] = [];

    for (const routine of this.routines.routines()) {
      if (!this.isRoutineVisible(routine.id) || !routineOccursOn(routine, dateKey)) {
        continue;
      }
      items.push({
        kind: 'routine',
        sort: routine.timeFrom || '99:99',
        card: {
          id: `${routine.id}_${dateKey}`,
          date: dateKey,
          title: routine.title,
          time: timeLabel(routine),
          progress: occurrenceProgress(routine, dateKey),
          routine,
          groups: groupRoutineItems(routine, lists),
        },
      });
    }

    if (this.showGoogleEvents()) {
      for (const event of this.calendarEvents()) {
        if (!calendarEventOnDate(event, dateKey)) {
          continue;
        }
        items.push({
          kind: 'event',
          sort: event.allDay ? '00:00' : event.startTime,
          event,
        });
      }
    }

    return items.sort((a, b) => a.sort.localeCompare(b.sort) || titleOf(a).localeCompare(titleOf(b), 'de'));
  }

  private async loadCalendarEvents(access: boolean): Promise<void> {
    if (!this.calendarConfigured() || !access) {
      this.calendarEvents.set([]);
      return;
    }
    const start = parseDateKey(this.todayKey);
    start.setHours(0, 0, 0, 0);
    const end = parseDateKey(addDateKeyDays(this.tomorrowKey, 1));
    end.setHours(0, 0, 0, 0);
    try {
      this.calendarEvents.set(await this.google.listEvents(start, end));
    } catch (error) {
      this.calendarEvents.set([]);
      this.snackBar.open(calendarErrorMessage(error), 'OK', { duration: 4000 });
    }
  }
}

function groupRoutineItems(
  routine: Routine,
  lists: { id: string; icon: string }[],
): ItemGroup[] {
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

function titleOf(item: TimelineItem): string {
  return item.kind === 'routine' ? (item.card?.title ?? '') : (item.event?.title ?? '');
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
