/**
 * Calendar provider abstraction. The app stores sessions in Supabase (source
 * of truth). A provider mirrors them to an external calendar when configured.
 * Add GoogleCalendarProvider / MicrosoftGraphProvider implementing this
 * interface and select it with CALENDAR_PROVIDER — no other code changes.
 */
export interface CalendarEvent {
  title: string;
  start: string;           // ISO
  durationMinutes: number;
  location?: string | null;
  meetingLink?: string | null;
  attendees: string[];     // emails
  notes?: string | null;
}

export interface CalendarProvider {
  readonly name: string;
  create(e: CalendarEvent): Promise<{ externalId: string | null }>;
  update(externalId: string, e: CalendarEvent): Promise<void>;
  cancel(externalId: string): Promise<void>;
}

export class NoopCalendarProvider implements CalendarProvider {
  readonly name = "none";
  async create() { return { externalId: null }; }
  async update() {}
  async cancel() {}
}

export function getCalendarProvider(): CalendarProvider {
  switch (process.env.CALENDAR_PROVIDER) {
    // case "google": return new GoogleCalendarProvider(...);
    // case "microsoft": return new MicrosoftGraphProvider(...);
    default: return new NoopCalendarProvider();
  }
}
