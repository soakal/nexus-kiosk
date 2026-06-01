import { getGraphClient } from './graphClient.js';
import { mockCalendars } from './mockData.js';
import { logger } from '../utils/logger.js';

export interface GraphCalendar {
  id: string;
  name: string;
  color: string;
  hexColor: string;
  isDefaultCalendar: boolean;
}

export async function listCalendars(): Promise<GraphCalendar[]> {
  if (process.env.DISABLE_AZURE === 'true') {
    logger.info('Test mode: returning mock calendars');
    return mockCalendars;
  }

  logger.debug('Fetching calendars from Graph API');
  const client = getGraphClient();

  const response = await client
    .api('/me/calendars')
    .select('id,name,color,hexColor,isDefaultCalendar')
    .get() as { value: GraphCalendar[] };

  logger.info(`Fetched ${response.value.length} calendars`);
  return response.value;
}
