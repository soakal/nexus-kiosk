import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'config.json');
const DEFAULT_CONFIG = {
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
    showWeather: false,
    weatherLocation: '',
    showClock: true,
    showDate: true,
    panels: ['clock', 'calendar'],
};
let cachedConfig = null;
function ensureDataDir() {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.debug('Created data directory', { dir });
    }
}
export function getConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    try {
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
            const stored = JSON.parse(raw);
            cachedConfig = deepMerge(DEFAULT_CONFIG, stored);
            logger.info('Config loaded from disk');
        }
        else {
            cachedConfig = { ...DEFAULT_CONFIG };
            logger.info('No config file found, using defaults');
        }
    }
    catch (err) {
        logger.error('Failed to load config, using defaults', { error: err });
        cachedConfig = { ...DEFAULT_CONFIG };
    }
    return cachedConfig;
}
export function updateConfig(partial) {
    const current = getConfig();
    cachedConfig = deepMerge(current, partial);
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(cachedConfig, null, 2), 'utf8');
    logger.info('Config updated and saved');
    return cachedConfig;
}
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceVal = source[key];
            const targetVal = target[key];
            if (sourceVal !== null &&
                typeof sourceVal === 'object' &&
                !Array.isArray(sourceVal) &&
                targetVal !== null &&
                typeof targetVal === 'object' &&
                !Array.isArray(targetVal)) {
                result[key] = deepMerge(targetVal, sourceVal);
            }
            else {
                result[key] = sourceVal;
            }
        }
    }
    return result;
}
