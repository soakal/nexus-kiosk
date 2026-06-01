import { getMsalInstance } from '../config/msalConfig.js';
import { saveTokens } from './tokenStore.js';
import { logger } from '../utils/logger.js';
const SCOPES = [
    'Calendars.Read',
    'User.Read',
    'offline_access',
    'Files.Read.All',
    'Sites.Read.All',
];
let _isPolling = false;
let _codeInfo = null;
export function isPolling() {
    return _isPolling;
}
export async function startDeviceCodeFlow() {
    _codeInfo = null;
    _isPolling = false;
    const msalApp = getMsalInstance();
    const completionPromise = new Promise((resolve) => {
        const request = {
            scopes: SCOPES,
            deviceCodeCallback: (response) => {
                logger.info('Device code received', { userCode: response.userCode });
                _codeInfo = {
                    userCode: response.userCode,
                    deviceCode: response.deviceCode,
                    verificationUri: response.verificationUri,
                    expiresIn: response.expiresIn,
                    interval: response.interval,
                    message: response.message,
                };
                _isPolling = true;
            },
        };
        msalApp
            .acquireTokenByDeviceCode(request)
            .then((result) => {
            if (!result) {
                logger.warn('Device code flow returned null result');
                _isPolling = false;
                resolve(false);
                return;
            }
            logger.info('Device code flow succeeded, extracting refresh token');
            try {
                const cache = msalApp.getTokenCache();
                const serialized = cache.serialize();
                const cacheObj = JSON.parse(serialized);
                const refreshTokenEntries = cacheObj.RefreshToken ?? {};
                const firstEntry = Object.values(refreshTokenEntries)[0];
                if (!firstEntry?.secret) {
                    logger.error('No refresh token found in MSAL cache');
                    _isPolling = false;
                    resolve(false);
                    return;
                }
                const refreshToken = firstEntry.secret;
                const accessToken = result.accessToken;
                const expiresOn = result.expiresOn
                    ? result.expiresOn.getTime()
                    : Date.now() + 3600 * 1000;
                saveTokens({ refreshToken, accessToken, expiresOn });
                logger.info('Tokens saved after device code flow');
                _isPolling = false;
                resolve(true);
            }
            catch (err) {
                logger.error('Failed to extract/save tokens', { error: err });
                _isPolling = false;
                resolve(false);
            }
        })
            .catch((err) => {
            logger.error('Device code flow error', { error: err });
            _isPolling = false;
            resolve(false);
        });
    });
    // Wait for deviceCodeCallback to populate _codeInfo
    await new Promise((resolve) => {
        const interval = setInterval(() => {
            if (_codeInfo !== null) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
    return { codeInfo: _codeInfo, completionPromise };
}
