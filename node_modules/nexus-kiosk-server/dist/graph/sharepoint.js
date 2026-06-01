import { getGraphClient } from './graphClient.js';
import { logger } from '../utils/logger.js';
export async function listRecentFiles(count = 20) {
    logger.debug('Fetching recent files from Graph API', { count });
    const client = getGraphClient();
    const response = await client
        .api('/me/drive/recent')
        .top(count)
        .get();
    logger.info(`Fetched ${response.value.length} recent files`);
    return response.value;
}
export async function listSites() {
    logger.debug('Fetching SharePoint sites from Graph API');
    const client = getGraphClient();
    const response = await client
        .api('/sites')
        .query({ search: '*' })
        .select('id,name,displayName,webUrl')
        .get();
    logger.info(`Fetched ${response.value.length} sites`);
    return response.value;
}
export async function listDrives(siteId) {
    logger.debug('Fetching drives for site', { siteId });
    const client = getGraphClient();
    const response = await client
        .api(`/sites/${siteId}/drives`)
        .select('id,name,driveType,webUrl')
        .get();
    logger.info(`Fetched ${response.value.length} drives for site ${siteId}`);
    return response.value;
}
export async function listFiles(driveId) {
    logger.debug('Fetching files for drive', { driveId });
    const client = getGraphClient();
    const response = await client
        .api(`/drives/${driveId}/root/children`)
        .select('id,name,webUrl,lastModifiedDateTime,size,file,folder,createdBy,lastModifiedBy')
        .get();
    logger.info(`Fetched ${response.value.length} files for drive ${driveId}`);
    return response.value;
}
