import { computed, Injectable, signal } from '@angular/core';
import { Auth } from '../auth/auth';
import { AppConfigService } from '../config/app-config.service';
import {
  AppCalendarEvent,
  CalendarApiError,
  CalendarEventInput,
  GoogleEventResource,
  googleResourceToEvent,
  toGoogleEventBody,
} from './google-calendar.model';

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  private readonly revisionState = signal(0);

  readonly revision = this.revisionState.asReadonly();

  readonly isConfigured = computed(() => this.appConfig.calendarConfigured());

  constructor(
    private readonly auth: Auth,
    private readonly appConfig: AppConfigService,
  ) {}

  calendarId(): string {
    return this.appConfig.googleCalendarId().trim();
  }

  async listEvents(timeMin: Date, timeMax: Date): Promise<AppCalendarEvent[]> {
    if (!this.isConfigured() || !this.auth.hasCalendarAccess()) {
      return [];
    }

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    const payload = await this.requestJson<{ items?: GoogleEventResource[] }>(
      `events?${params.toString()}`,
    );
    return (payload.items ?? []).map(googleResourceToEvent).filter((item): item is AppCalendarEvent => !!item);
  }

  async getEvent(eventId: string): Promise<AppCalendarEvent> {
    const event = await this.fetchEvent(eventId);
    if (!event.recurringEventId) {
      return event;
    }
    try {
      const series = await this.fetchEvent(event.recurringEventId);
      return { ...event, recurrence: series.recurrence };
    } catch {
      return event;
    }
  }

  private async fetchEvent(eventId: string): Promise<AppCalendarEvent> {
    const payload = await this.requestJson<GoogleEventResource>(
      `events/${encodeURIComponent(eventId)}`,
    );
    const event = googleResourceToEvent(payload);
    if (!event) {
      throw new CalendarApiError('Termin konnte nicht geladen werden.', 404);
    }
    return event;
  }

  async createEvent(input: CalendarEventInput): Promise<void> {
    await this.requestJson('events', {
      method: 'POST',
      body: JSON.stringify(toGoogleEventBody(input)),
    });
    this.bump();
  }

  async updateEvent(
    eventId: string,
    input: CalendarEventInput,
    options: { includeRecurrence: boolean; isUpdate?: boolean } = { includeRecurrence: true },
  ): Promise<void> {
    await this.requestJson(`events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(toGoogleEventBody(input, { ...options, isUpdate: true })),
    });
    this.bump();
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.request(`events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
    this.bump();
  }

  bump(): void {
    this.revisionState.update((value) => value + 1);
  }

  private async requestJson<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const response = await this.request(path, init, retry);
    if (response.status === 204) {
      return {} as T;
    }
    return (await response.json()) as T;
  }

  private async request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await this.auth.ensureCalendarAccess();
    const response = await fetch(`${this.calendarUrl()}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });

    if (response.status === 401 && retry) {
      this.auth.clearCalendarToken();
      return this.request(path, init, false);
    }

    if (!response.ok) {
      throw new CalendarApiError(await errorMessage(response), response.status);
    }

    return response;
  }

  private calendarUrl(): string {
    return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId())}`;
  }
}

async function errorMessage(response: Response): Promise<string> {
  if (response.status === 404) {
    return 'Kalender nicht gefunden. Bitte die Kalender-ID prüfen.';
  }
  if (response.status === 403) {
    return 'Kein Zugriff auf den Kalender. API aktivieren und den Kalender mit diesem Google-Konto teilen.';
  }
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    // ignore
  }
  return 'Google Kalender hat die Anfrage abgelehnt.';
}
