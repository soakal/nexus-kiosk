import { Router, Request, Response, NextFunction } from 'express';
import { listEvents, GraphEvent } from '../graph/events.js';
import { listCalendars, GraphCalendar } from '../graph/calendars.js';
import { isAuthenticated } from '../auth/tokenRefresher.js';
import { getConfig } from '../services/configService.js';
import { logger } from '../utils/logger.js';

export const eventsRouter = Router();

export interface NormalizedEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location?: string;
  organizer?: { name: string; email: string };
  bodyPreview?: string;
  webLink?: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  calendarHexColor: string;
}

eventsRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!isAuthenticated()) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const config = getConfig();

      // Determine date range
      const now = new Date();
      const startParam = (req.query.start as string | undefined) ?? now.toISOString();

      const defaultEnd = new Date(now);
      defaultEnd.setDate(defaultEnd.getDate() + config.calendar.daysToShow);
      const endParam =
        (req.query.end as string | undefined) ?? defaultEnd.toISOString();

      logger.debug('GET /api/events', { start: startParam, end: endParam });

      // Fetch calendars and events in parallel
      const [calendars, events] = await Promise.all([
        listCalendars(),
        (async (): Promise<GraphEvent[]> => {
          const calendarIds =
            config.calendar.enabledCalendarIds.length > 0
              ? config.calendar.enabledCalendarIds
              : (await listCalendars()).map((c) => c.id);
          return listEvents(calendarIds, startParam, endParam);
        })(),
      ]);

      const calendarMap = new Map<string, GraphCalendar>();
      for (const cal of calendars) {
        calendarMap.set(cal.id, cal);
      }

      const normalized: NormalizedEvent[] = events.map((event) => {
        const cal = calendarMap.get(event.calendarId);
        return {
          id: event.id,
          subject: event.subject,
          start: event.start,
          end: event.end,
          isAllDay: event.isAllDay,
          location: event.location?.displayName,
          organizer: event.organizer
            ? {
                name: event.organizer.emailAddress.name,
                email: event.organizer.emailAddress.address,
              }
            : undefined,
          bodyPreview: event.bodyPreview,
          webLink: event.webLink,
          calendarId: event.calendarId,
          calendarName: cal?.name ?? 'Unknown',
          calendarColor: cal?.color ?? 'auto',
          calendarHexColor: cal?.hexColor ?? '#0078D4',
        };
      });

      res.json(normalized);
    } catch (err) {
      next(err);
    }
  }
);
