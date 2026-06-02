import { Router, Request, Response, NextFunction } from 'express';
import { getConfig, updateConfig, AppConfig } from '../services/configService.js';
import { isAuthenticated } from '../auth/tokenRefresher.js';
import { logger } from '../utils/logger.js';

export const configRouter = Router();

/**
 * The server stores config in a nested shape (calendar, display, sharepoint
 * sub-objects). The React client expects a flat AppConfig (see
 * client/src/types/index.ts). This function translates between the two so the
 * client never receives the wrong shape and crashes on undefined property access.
 */
function toClientConfig(cfg: AppConfig): Record<string, unknown> {
  return {
    calendarIds: Array.isArray(cfg.calendar?.enabledCalendarIds)
      ? cfg.calendar.enabledCalendarIds
      : [],
    displayMode: 'week',
    refreshInterval: cfg.display?.refreshIntervalSeconds ?? 300,
    theme: cfg.display?.theme === 'auto' ? 'dark' : (cfg.display?.theme ?? 'dark'),
    timezone: cfg.display?.timezone ?? 'America/New_York',
    showWeekends: true,
    startHour: 7,
    endHour: 21,
    showAgendaRail: true,
    showWeather: cfg.showWeather ?? false,
    showNextEvent: true,
    weatherLat: null,
    weatherLon: null,
    timeFormat: cfg.display?.timeFormat ?? '12h',
    tempUnit: 'F',
    showRecentFiles: cfg.sharepoint?.enableRecentFiles ?? false,
    recentFilesCount: cfg.sharepoint?.recentFilesCount ?? 8,
    sharePointSiteIds: cfg.sharepoint?.defaultSiteId ? [cfg.sharepoint.defaultSiteId] : [],
    fileOpenMode: 'same-window',
  };
}

/**
 * Accept the flat client AppConfig shape on POST and translate it back to the
 * server's nested shape so configService can persist it correctly.
 */
function fromClientConfig(flat: Record<string, unknown>): Partial<AppConfig> {
  const partial: Partial<AppConfig> = {};

  if ('calendarIds' in flat && Array.isArray(flat.calendarIds)) {
    partial.calendar = { enabledCalendarIds: flat.calendarIds as string[] } as AppConfig['calendar'];
  }
  if ('showWeather' in flat) {
    partial.showWeather = Boolean(flat.showWeather);
  }
  if ('refreshInterval' in flat || 'timezone' in flat || 'timeFormat' in flat || 'theme' in flat) {
    partial.display = {
      timezone: (flat.timezone as string | undefined) ?? 'America/New_York',
      dateFormat: 'MMMM D, YYYY',
      timeFormat: (flat.timeFormat as '12h' | '24h' | undefined) ?? '12h',
      theme: (flat.theme as 'dark' | 'light' | 'auto' | undefined) ?? 'dark',
      refreshIntervalSeconds: typeof flat.refreshInterval === 'number' ? flat.refreshInterval : 300,
    };
  }
  if ('showRecentFiles' in flat || 'recentFilesCount' in flat) {
    partial.sharepoint = {
      enableRecentFiles: Boolean(flat.showRecentFiles),
      recentFilesCount: typeof flat.recentFilesCount === 'number' ? flat.recentFilesCount : 8,
      defaultSiteId: null,
      defaultDriveId: null,
    };
  }

  return partial;
}

configRouter.get(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      logger.debug('GET /api/config');
      const config = getConfig();
      res.json(toClientConfig(config));
    } catch (err) {
      next(err);
    }
  }
);

configRouter.post(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      logger.debug('POST /api/config');
      // Body may be a flat client shape or the legacy nested shape
      const body = req.body as Record<string, unknown>;
      // Detect flat client shape by presence of top-level calendarIds key
      const partial = ('calendarIds' in body || 'showWeather' in body || 'refreshInterval' in body)
        ? fromClientConfig(body)
        : (body as Partial<AppConfig>);
      const updated = updateConfig(partial);
      res.json(toClientConfig(updated));
    } catch (err) {
      next(err);
    }
  }
);

configRouter.get(
  '/health',
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json({
        status: 'ok',
        authenticated: isAuthenticated(),
        uptime: process.uptime(),
      });
    } catch (err) {
      next(err);
    }
  }
);
