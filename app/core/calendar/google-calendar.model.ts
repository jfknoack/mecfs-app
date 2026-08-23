export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type EventVisibility = 'default' | 'public' | 'private';
export type EventTransparency = 'opaque' | 'transparent';
export type EventReminder =
  | 'default'
  | 'none'
  | '5'
  | '10'
  | '15'
  | '30'
  | '60'
  | '120'
  | '1440'
  | '2880';

export interface CalendarEventInput {
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  recurrence: EventRecurrence;
  visibility: EventVisibility;
  transparency: EventTransparency;
  reminder: EventReminder;
}

export interface AppCalendarEvent extends CalendarEventInput {
  id: string;
  start: string;
  end?: string;
  recurringEventId: string | null;
}

export class CalendarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CalendarApiError';
  }
}

export const CALENDAR_TIME_ZONE = 'Europe/Berlin';

export const EVENT_RECURRENCE_OPTIONS: { value: EventRecurrence; label: string }[] = [
  { value: 'none', label: 'Nicht wiederholen' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
];

export const EVENT_REMINDER_OPTIONS: { value: EventReminder; label: string }[] = [
  { value: 'default', label: 'Kalender-Standard' },
  { value: 'none', label: 'Keine' },
  { value: '5', label: '5 Minuten vorher' },
  { value: '10', label: '10 Minuten vorher' },
  { value: '15', label: '15 Minuten vorher' },
  { value: '30', label: '30 Minuten vorher' },
  { value: '60', label: '1 Stunde vorher' },
  { value: '120', label: '2 Stunden vorher' },
  { value: '1440', label: '1 Tag vorher' },
  { value: '2880', label: '2 Tage vorher' },
];

export function emptyCalendarEventInput(date = todayDateKey(), allDay = true): CalendarEventInput {
  return {
    title: '',
    description: '',
    location: '',
    allDay,
    startDate: date,
    endDate: date,
    startTime: '10:00',
    endTime: '11:00',
    recurrence: 'none',
    visibility: 'default',
    transparency: 'opaque',
    reminder: 'default',
  };
}

export function googleResourceToEvent(item: GoogleEventResource): AppCalendarEvent | null {
  const id = item.id?.trim();
  const startRaw = item.start?.dateTime || item.start?.date;
  if (!id || !startRaw) {
    return null;
  }

  const allDay = Boolean(item.start?.date && !item.start.dateTime);
  const startParts = allDay ? splitDate(item.start?.date) : splitDateTime(item.start?.dateTime);
  if (!startParts) {
    return null;
  }
  let endParts = allDay
    ? splitDate(inclusiveAllDayEnd(item.start?.date, item.end?.date))
    : splitDateTime(item.end?.dateTime);
  if (!endParts || (!allDay && endParts.date === startParts.date && endParts.time === startParts.time)) {
    endParts = addHour(startParts);
  }

  return {
    id,
    title: item.summary?.trim() || '(ohne Titel)',
    description: item.description ?? '',
    location: item.location ?? '',
    allDay,
    startDate: startParts.date,
    endDate: endParts.date,
    startTime: startParts.time,
    endTime: endParts.time,
    start: startRaw,
    end: item.end?.dateTime || item.end?.date,
    recurrence: parseRecurrence(item.recurrence),
    visibility: parseVisibility(item.visibility),
    transparency: item.transparency === 'transparent' ? 'transparent' : 'opaque',
    reminder: parseReminder(item.reminders),
    recurringEventId: item.recurringEventId?.trim() || null,
  };
}

export function toGoogleEventBody(
  input: CalendarEventInput,
  options: { includeRecurrence: boolean; isUpdate?: boolean } = { includeRecurrence: true },
): Record<string, unknown> {
  const title = input.title.trim();
  const body: Record<string, unknown> = {
    summary: title,
    description: input.description.trim(),
    location: input.location.trim(),
    visibility: input.visibility,
    transparency: input.transparency,
    reminders: toGoogleReminders(input.reminder),
    start: toGoogleDate(input.startDate, input.startTime, input.allDay),
    end: toGoogleDate(
      input.allDay ? addDays(input.endDate, 1) : input.endDate,
      input.endTime,
      input.allDay,
    ),
  };
  if (options.includeRecurrence) {
    const rules = toGoogleRecurrence(input.recurrence, input.startDate);
    if (rules.length || options.isUpdate) {
      body['recurrence'] = rules;
    }
  }
  return body;
}

export function eventTimesValid(input: CalendarEventInput): boolean {
  if (!isDateKey(input.startDate) || !isDateKey(input.endDate)) {
    return false;
  }
  if (input.allDay) {
    return input.endDate >= input.startDate;
  }
  if (!isTimeValue(input.startTime) || !isTimeValue(input.endTime)) {
    return false;
  }
  return `${input.startDate}T${input.startTime}` < `${input.endDate}T${input.endTime}`;
}

export function calendarEventOnDate(event: AppCalendarEvent, dateKey: string): boolean {
  return event.startDate <= dateKey && dateKey <= event.endDate;
}

export function calendarEventTimeLabel(event: AppCalendarEvent): string {
  if (event.allDay) {
    return 'Ganztägig';
  }
  if (event.startDate === event.endDate) {
    return `${event.startTime}–${event.endTime}`;
  }
  return `${event.startTime}–${event.endTime}`;
}

export function toCalendarEventInput(event: AppCalendarEvent): CalendarEventInput {
  return {
    title: event.title === '(ohne Titel)' ? '' : event.title,
    description: event.description,
    location: event.location,
    allDay: event.allDay,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    recurrence: event.recurrence,
    visibility: event.visibility,
    transparency: event.transparency,
    reminder: event.reminder,
  };
}

export interface GoogleEventResource {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  visibility?: string;
  transparency?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: { method?: string; minutes?: number }[];
  };
  recurringEventId?: string;
}

function toGoogleDate(date: string, time: string, allDay: boolean): Record<string, string> {
  if (allDay) {
    return { date };
  }
  return {
    dateTime: `${date}T${normalizeTime(time)}:00`,
    timeZone: CALENDAR_TIME_ZONE,
  };
}

function toGoogleRecurrence(recurrence: EventRecurrence, startDate: string): string[] {
  if (recurrence === 'none') {
    return [];
  }
  if (recurrence === 'daily') {
    return ['RRULE:FREQ=DAILY'];
  }
  if (recurrence === 'weekly') {
    return [`RRULE:FREQ=WEEKLY;BYDAY=${weekdayCode(startDate)}`];
  }
  if (recurrence === 'monthly') {
    return ['RRULE:FREQ=MONTHLY'];
  }
  return ['RRULE:FREQ=YEARLY'];
}

function toGoogleReminders(reminder: EventReminder): Record<string, unknown> {
  if (reminder === 'default') {
    return { useDefault: true };
  }
  if (reminder === 'none') {
    return { useDefault: false, overrides: [] };
  }
  return {
    useDefault: false,
    overrides: [{ method: 'popup', minutes: Number(reminder) }],
  };
}

function parseRecurrence(rules?: string[]): EventRecurrence {
  const rule = rules?.[0] ?? '';
  if (/FREQ=DAILY/i.test(rule)) {
    return 'daily';
  }
  if (/FREQ=WEEKLY/i.test(rule)) {
    return 'weekly';
  }
  if (/FREQ=MONTHLY/i.test(rule)) {
    return 'monthly';
  }
  if (/FREQ=YEARLY/i.test(rule)) {
    return 'yearly';
  }
  return 'none';
}

function parseVisibility(value?: string): EventVisibility {
  if (value === 'public' || value === 'private') {
    return value;
  }
  return 'default';
}

function parseReminder(reminders?: GoogleEventResource['reminders']): EventReminder {
  if (!reminders || reminders.useDefault) {
    return 'default';
  }
  const minutes = reminders.overrides?.find((item) => item.minutes != null)?.minutes;
  if (minutes == null) {
    return 'none';
  }
  const match = EVENT_REMINDER_OPTIONS.find((option) => option.value === String(minutes));
  return (match?.value as EventReminder) ?? 'default';
}

function addHour(parts: { date: string; time: string }): { date: string; time: string } {
  const date = parseDateKey(parts.date);
  const [hours, minutes] = parts.time.split(':').map(Number);
  date.setHours(hours ?? 0, (minutes ?? 0) + 60, 0, 0);
  return {
    date: toDateKey(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

function splitDate(value?: string): { date: string; time: string } | null {
  if (!value || !isDateKey(value.slice(0, 10))) {
    return null;
  }
  return { date: value.slice(0, 10), time: '00:00' };
}

function splitDateTime(value?: string): { date: string; time: string } | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return splitDate(value.slice(0, 10));
  }
  return {
    date: toDateKey(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

function inclusiveAllDayEnd(startDate?: string, exclusiveEnd?: string): string {
  const start = startDate?.slice(0, 10) ?? todayDateKey();
  if (!exclusiveEnd || !isDateKey(exclusiveEnd.slice(0, 10))) {
    return start;
  }
  const inclusive = addDays(exclusiveEnd.slice(0, 10), -1);
  return inclusive < start ? start : inclusive;
}

function weekdayCode(dateKey: string): string {
  const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return codes[parseDateKey(dateKey).getDay()] ?? 'MO';
}

function normalizeTime(value: string): string {
  const [hours, minutes] = value.split(':');
  return `${(hours ?? '00').padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}`;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function todayDateKey(): string {
  return toDateKey(new Date());
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function addDays(isoDate: string, days: number): string {
  const date = parseDateKey(isoDate);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
