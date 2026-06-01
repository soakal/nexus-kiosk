import cron from 'node-cron';
import { loadTokens, saveTokens, TokenData } from './tokenStore.js';
import { logger } from '../utils/logger.js';

let currentAccessToken: string | null = null;

export function getCurrentAccessToken(): string | null {
  return currentAccessToken;
}

export function isAuthenticated(): boolean {
  return currentAccessToken !== null;
}

export function setUnauthenticated(): void {
  currentAccessToken = null;
  logger.warn('Access token cleared — marked unauthenticated');
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresOn: number;
}

async function refreshViaEndpoint(rt: string): Promise<RefreshResponse> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;

  if (!tenantId) throw new Error('AZURE_TENANT_ID is required');
  if (!clientId) throw new Error('AZURE_CLIENT_ID is required');

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: rt,
    scope:
      'Calendars.Read User.Read offline_access Files.Read.All Sites.Read.All',
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token refresh failed: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? rt,
    expiresOn: Date.now() + json.expires_in * 1000,
  };
}

export async function initializeTokens(): Promise<boolean> {
  logger.info('Initializing tokens from stored data');

  const stored: TokenData | null = loadTokens();
  if (!stored) {
    logger.warn('No stored tokens found — authentication required');
    return false;
  }

  try {
    const refreshed = await refreshViaEndpoint(stored.refreshToken);
    currentAccessToken = refreshed.accessToken;

    saveTokens({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresOn: refreshed.expiresOn,
    });

    logger.info('Tokens initialized and refreshed successfully');
    return true;
  } catch (err) {
    logger.error('Failed to refresh stored tokens', { error: err });
    return false;
  }
}

export function startRefreshCron(): void {
  // Every 55 minutes
  cron.schedule('*/55 * * * *', async () => {
    logger.info('Cron: refreshing access token');
    const stored = loadTokens();
    if (!stored) {
      logger.warn('Cron: no stored tokens, cannot refresh');
      setUnauthenticated();
      return;
    }

    try {
      const refreshed = await refreshViaEndpoint(stored.refreshToken);
      currentAccessToken = refreshed.accessToken;

      saveTokens({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresOn: refreshed.expiresOn,
      });

      logger.info('Cron: access token refreshed successfully');
    } catch (err) {
      logger.error('Cron: token refresh failed', { error: err });
      setUnauthenticated();
    }
  });

  logger.info('Token refresh cron started (every 55 minutes)');
}
