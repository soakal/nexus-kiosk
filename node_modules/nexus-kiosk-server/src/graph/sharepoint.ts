import { getGraphClient } from './graphClient.js';
import { logger } from '../utils/logger.js';

export interface GraphDriveItem {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  size?: number;
  file?: { mimeType: string };
  folder?: { childCount: number };
  createdBy?: { user: { displayName: string } };
  lastModifiedBy?: { user: { displayName: string } };
}

export interface GraphSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

export interface GraphDrive {
  id: string;
  name: string;
  driveType: string;
  webUrl?: string;
}

export async function listRecentFiles(count = 20): Promise<GraphDriveItem[]> {
  logger.debug('Fetching recent files from Graph API', { count });
  const client = getGraphClient();

  const response = await client
    .api('/me/drive/recent')
    .top(count)
    .get() as { value: GraphDriveItem[] };

  logger.info(`Fetched ${response.value.length} recent files`);
  return response.value;
}

export async function listSites(): Promise<GraphSite[]> {
  logger.debug('Fetching SharePoint sites from Graph API');
  const client = getGraphClient();

  const response = await client
    .api('/sites')
    .query({ search: '*' })
    .select('id,name,displayName,webUrl')
    .get() as { value: GraphSite[] };

  logger.info(`Fetched ${response.value.length} sites`);
  return response.value;
}

export async function listDrives(siteId: string): Promise<GraphDrive[]> {
  logger.debug('Fetching drives for site', { siteId });
  const client = getGraphClient();

  const response = await client
    .api(`/sites/${siteId}/drives`)
    .select('id,name,driveType,webUrl')
    .get() as { value: GraphDrive[] };

  logger.info(`Fetched ${response.value.length} drives for site ${siteId}`);
  return response.value;
}

export async function listFiles(driveId: string): Promise<GraphDriveItem[]> {
  logger.debug('Fetching files for drive', { driveId });
  const client = getGraphClient();

  const response = await client
    .api(`/drives/${driveId}/root/children`)
    .select('id,name,webUrl,lastModifiedDateTime,size,file,folder,createdBy,lastModifiedBy')
    .get() as { value: GraphDriveItem[] };

  logger.info(`Fetched ${response.value.length} files for drive ${driveId}`);
  return response.value;
}
