import { getGraphClient } from './graphClient.js';
import { logger } from '../utils/logger.js';
export async function listEvents(calendarIds, start, end) {
    logger.debug('Fetching events from Graph API', {
        calendarCount: calendarIds.length,
        start,
        end,
    });
    const client = getGraphClient();
    const results = await Promise.allSettled(calendarIds.map(async (calendarId) => {
        const response = await client
            .api(`/me/calendars/${calendarId}/calendarView`)
            .query({
            startDateTime: start,
            endDateTime: end,
        })
            .select('id,subject,start,end,isAllDay,location,organizer,bodyPreview,webLink')
            .orderby('start/dateTime')
            .top(100)
            .get();
        return response.value.map((event) => ({
            ...event,
            calendarId,
        }));
    }));
    const allEvents = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            allEvents.push(...result.value);
        }
        else {
            logger.warn('Failed to fetch events for a calendar', {
                reason: result.reason,
            });
        }
    }
    allEvents.sort((a, b) => {
        const aTime = new Date(a.start.dateTime).getTime();
        const bTime = new Date(b.start.dateTime).getTime();
        return aTime - bTime;
    });
    logger.info(`Fetched ${allEvents.length} total events across all calendars`);
    return allEvents;
}
