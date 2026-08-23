export type RoutineVisibility = 'private' | 'public';
export type RoutineRecurrence = 'once' | 'daily' | 'weekly';
export type RoutineItemKind = 'listEntry' | 'recipe';

/** Orange bleibt Google-Terminen vorbehalten und ist hier nicht enthalten. */
export const ROUTINE_COLOR_OPTIONS = [
  { name: 'magenta', label: 'Magenta', hex: '#c2185b' },
  { name: 'red', label: 'Rot', hex: '#c62828' },
  { name: 'purple', label: 'Lila', hex: '#7b1fa2' },
  { name: 'indigo', label: 'Indigo', hex: '#3949ab' },
  { name: 'blue', label: 'Blau', hex: '#1565c0' },
  { name: 'teal', label: 'Türkis', hex: '#00838f' },
  { name: 'green', label: 'Grün', hex: '#2e7d32' },
  { name: 'lime', label: 'Limette', hex: '#9e9d24' },
  { name: 'yellow', label: 'Gelb', hex: '#f9a825' },
  { name: 'brown', label: 'Braun', hex: '#6d4c41' },
  { name: 'slate', label: 'Grau', hex: '#546e7a' },
] as const;

export type RoutineColor = (typeof ROUTINE_COLOR_OPTIONS)[number]['name'];

export const DEFAULT_ROUTINE_COLOR: RoutineColor = 'magenta';
export const GOOGLE_CALENDAR_EVENT_COLOR = '#ea580c';

export function normalizeRoutineColor(value: unknown): RoutineColor {
  const name = String(value ?? '');
  return ROUTINE_COLOR_OPTIONS.some((color) => color.name === name)
    ? (name as RoutineColor)
    : DEFAULT_ROUTINE_COLOR;
}

export function routineColorHex(color: string): string {
  return (
    ROUTINE_COLOR_OPTIONS.find((option) => option.name === color)?.hex ??
    ROUTINE_COLOR_OPTIONS[0].hex
  );
}

export interface RoutineItem {
  id: string;
  kind: RoutineItemKind;
  listId: string;
  listName: string;
  entryId: string;
  recipeId: string;
  text: string;
}

export interface Routine {
  id: string;
  title: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  recurrence: RoutineRecurrence;
  weekdays: number[];
  visibility: RoutineVisibility;
  color: RoutineColor;
  authorUid: string;
  authorName: string;
  items: RoutineItem[];
  completions: Record<string, Record<string, boolean>>;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateRoutineInput {
  title: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  recurrence: RoutineRecurrence;
  weekdays: number[];
  visibility: RoutineVisibility;
  color: RoutineColor;
}

export interface UpdateRoutineInput extends CreateRoutineInput {}

export interface RoutineOccurrenceEvent {
  id: string;
  routineId: string;
  title: string;
  date: string;
  start: string;
  end: string | null;
  done: boolean;
  color: RoutineColor;
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 7, label: 'So' },
] as const;

export function routineIconClass(iconName: string): string {
  return `fa-solid fa-${iconName}`;
}

export function newRoutineItemId(): string {
  return crypto.randomUUID();
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function routineOccursOn(routine: Routine, dateKey: string): boolean {
  if (!isDateKey(dateKey) || dateKey < routine.date) {
    return false;
  }
  if (routine.recurrence === 'once') {
    return dateKey === routine.date;
  }
  if (routine.recurrence === 'daily') {
    return true;
  }
  return routine.weekdays.includes(isoWeekday(parseDateKey(dateKey)));
}

export function isItemChecked(routine: Routine, dateKey: string, itemId: string): boolean {
  return Boolean(routine.completions[dateKey]?.[itemId]);
}

export function isOccurrenceDone(routine: Routine, dateKey: string): boolean {
  return occurrenceProgress(routine, dateKey) === 'done';
}

export type OccurrenceProgress = 'none' | 'partial' | 'done';

export function occurrenceProgress(routine: Routine, dateKey: string): OccurrenceProgress {
  if (!routine.items.length) {
    return 'none';
  }
  let checked = 0;
  for (const item of routine.items) {
    if (isItemChecked(routine, dateKey, item.id)) {
      checked += 1;
    }
  }
  if (checked === 0) {
    return 'none';
  }
  if (checked === routine.items.length) {
    return 'done';
  }
  return 'partial';
}

export function addDateKeyDays(dateKey: string, days: number): string {
  return toDateKey(addDays(parseDateKey(dateKey), days));
}

export function recurrenceLabel(routine: Routine): string {
  if (routine.recurrence === 'once') {
    return `Einmalig · ${formatDateLabel(routine.date)}`;
  }
  if (routine.recurrence === 'daily') {
    return `Täglich ab ${formatDateLabel(routine.date)}`;
  }
  const days = WEEKDAY_OPTIONS.filter((day) => routine.weekdays.includes(day.value))
    .map((day) => day.label)
    .join(', ');
  return days ? `Wöchentlich · ${days}` : 'Wöchentlich';
}

export function timeLabel(routine: Routine): string {
  if (routine.timeTo) {
    return `${routine.timeFrom}–${routine.timeTo}`;
  }
  return routine.timeFrom;
}

export function formatDateLabel(dateKey: string): string {
  if (!isDateKey(dateKey)) {
    return dateKey;
  }
  return parseDateKey(dateKey).toLocaleDateString('de-DE');
}

export function expandRoutineEvents(
  routines: Routine[],
  rangeStart: Date,
  rangeEnd: Date,
): RoutineOccurrenceEvent[] {
  const startKey = toDateKey(rangeStart);
  const endKey = toDateKey(addDays(rangeEnd, -1));
  const events: RoutineOccurrenceEvent[] = [];

  for (const routine of routines) {
    let cursor = routine.date > startKey ? routine.date : startKey;
    while (cursor <= endKey) {
      if (routineOccursOn(routine, cursor)) {
        events.push({
          id: `${routine.id}_${cursor}`,
          routineId: routine.id,
          title: routine.title,
          date: cursor,
          start: `${cursor}T${routine.timeFrom}:00`,
          end: routine.timeTo ? `${cursor}T${routine.timeTo}:00` : null,
          done: isOccurrenceDone(routine, cursor),
          color: routine.color,
        });
      }
      if (routine.recurrence === 'once') {
        break;
      }
      cursor = toDateKey(addDays(parseDateKey(cursor), 1));
    }
  }

  return events;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
