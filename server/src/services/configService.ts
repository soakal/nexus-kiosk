import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'data',
  'config.json'
);

export interface CalendarConfig {
  enabledCalendarIds: string[];
  daysToShow: number;
  showAllDayEvents: boolean;
  showDeclinedEvents: boolean;
}

export interface DisplayConfig {
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  theme: 'dark' | 'light' | 'auto';
  refreshIntervalSeconds: number;
}

export interface SharePointConfig {
  enableRecentFiles: boolean;
  recentFilesCount: number;
  defaultSiteId: string | null;
  defaultDriveId: string | null;
}

/**
 * Persists all client UI-only settings that have no natural home in the other
 * nested config objects.  Stored under the "ui" key in config.json.
 */
export interface UiConfig {
  displayMode: 'day' | 'week' | 'month';
  showWeekends: boolean;
  startHour: number;
  endHour: number;
  showAgendaRail: boolean;
  showNextEvent: boolean;
  weatherLat: number | null;
  weatherLon: number | null;
  tempUnit: 'F' | 'C';
  fileOpenMode: 'same-window' | 'new-window';
  sharePointSiteIds: string[];
}

export interface AppConfig {
  calendar: CalendarConfig;
  display: DisplayConfig;
  sharepoint: SharePointConfig;
  ui: UiConfig;
  showWeather: boolean;
  weatherLocation: string;
  showClock: boolean;
  showDate: boolean;
  panels: string[];
}

const DEFAULT_CONFIG: AppConfig = {
  calendar: {
    enabledCalendarIds: [],
    daysToShow: 7,
    showAllDayEvents: true,
    showDeclinedEvents: false,
  },
  display: {
    timezone: 'America/New_York',
    dateFormat: 'MMMM D, YYYY',
    timeFormat: '12h',
    theme: 'dark',
    refreshIntervalSeconds: 300,
  },
  sharepoint: {
    enableRecentFiles: false,
    recentFilesCount: 10,
    defaultSiteId: null,
    defaultDriveId: null,
  },
  ui: {
    displayMode: 'week',
    showWeekends: false,
    startHour: 7,
    endHour: 21,
    showAgendaRail: true,
    showNextEvent: true,
    weatherLat: null,
    weatherLon: null,
    tempUnit: 'F',
    fileOpenMode: 'same-window',
    sharePointSiteIds: [],
  },
  showWeather: false,
  weatherLocation: '',
  showClock: true,
  showDate: true,
  panels: ['clock', 'calendar'],
};

let cachedConfig: AppConfig | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(CONFIG_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.debug('Created data directory', { dir });
  }
}

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      const stored = JSON.parse(raw) as Partial<AppConfig>;
      cachedConfig = deepMerge(DEFAULT_CONFIG, stored);
      logger.info('Config loaded from disk');
    } else {
      cachedConfig = { ...DEFAULT_CONFIG };
      logger.info('No config file found, using defaults');
    }
  } catch (err) {
    logger.error('Failed to load config, using defaults', { error: err });
    cachedConfig = { ...DEFAULT_CONFIG };
  }

  return cachedConfig;
}

export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig();
  cachedConfig = deepMerge(current, partial);

  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(cachedConfig, null, 2), 'utf8');
  logger.info('Config updated and saved');

  return cachedConfig;
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceVal = source[key];
      const targetVal = target[key];
      if (
        sourceVal !== null &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        targetVal !== null &&
        typeof targetVal === 'object' &&
        !Array.isArray(targetVal)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetVal as object,
          sourceVal as Partial<object>
        );
      } else {
        (result as Record<string, unknown>)[key] = sourceVal;
      }
    }
  }
  return result;
}
