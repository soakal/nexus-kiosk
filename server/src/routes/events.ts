import { Router, Request, Response, NextFunction } from 'express';
import { listEvents, GraphEvent } from '../graph/events.js';
import { listCalendars, GraphCalendar } from '../graph/calendars.js';
import { isAuthenticated } from '../auth/tokenRefresher.js';
import { getConfig } from '../services/configService.js';
import { logger } from '../utils/logger.js';
import { getMergedJobs, getBoardConfig } from '../services/boardService.js';

export const eventsRouter = Router();

/**
 * Shape returned to the client — must match client/src/types/index.ts CalendarEvent.
 * The Graph API returns start/end as nested objects; we flatten them here so the
 * client can use startDateTime / endDateTime directly without crashing.
 */
export interface NormalizedEvent {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  isAllDay: boolean;
  location?: string;
  bodyPreview: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
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
          // Flatten nested Graph dateTime objects into the flat strings the client expects
          startDateTime: event.start.dateTime,
          endDateTime: event.end.dateTime,
          isAllDay: event.isAllDay,
          location: event.location?.displayName,
          bodyPreview: event.bodyPreview ?? '',
          calendarId: event.calendarId ?? '',
          calendarName: cal?.name ?? 'Unknown',
          calendarColor: cal?.hexColor ?? '#3b82f6',
        };
      });

      // Append board job ship dates as all-day calendar events
      try {
        const boardJobs = getMergedJobs();
        const boardConfig = getBoardConfig();
        const statusColors: Record<string, string> = boardConfig.statusColors as Record<string, string>;
        const statusLabels: Record<string, string> = {
          none: 'Not Started', in_progress: 'In Progress',
          ready_to_ship: 'Ready to Ship', shipped: 'Shipped',
        };

        for (const job of boardJobs) {
          if (!job.effectiveShipDate) continue;
          const pm = job.pm ?? '';
          const pmDisplay = pm.includes('@') ? pm.split('@')[0] : pm;
          const customer = job.customer ?? '';
          normalized.push({
            id: `board-ship-${job.jobNumber}`,
            subject: `#${job.jobNumber} — ${customer} · ${pmDisplay}`,
            startDateTime: `${job.effectiveShipDate}T00:00:00`,
            endDateTime: `${job.effectiveShipDate}T23:59:59`,
            isAllDay: true,
            bodyPreview: `${customer} · ${statusLabels[job.status] ?? job.status}`,
            calendarId: 'board-jobs',
            calendarName: 'Ship Dates',
            calendarColor: statusColors[job.status] ?? '#475569',
          });
        }
      } catch {
        // Board data may not exist yet — skip silently
      }

      res.json(normalized);
    } catch (err) {
      next(err);
    }
  }
);
