import { getGraphClient } from './graphClient.js';
import { logger } from '../utils/logger.js';
export async function listCalendars() {
    logger.debug('Fetching calendars from Graph API');
    const client = getGraphClient();
    const response = await client
        .api('/me/calendars')
        .select('id,name,color,hexColor,isDefaultCalendar')
        .get();
    logger.info(`Fetched ${response.value.length} calendars`);
    return response.value;
}
