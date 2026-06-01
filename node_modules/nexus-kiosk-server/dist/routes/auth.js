import { Router } from 'express';
import { startDeviceCodeFlow, isPolling } from '../auth/deviceCodeFlow.js';
import { isAuthenticated } from '../auth/tokenRefresher.js';
import { getGraphClient } from '../graph/graphClient.js';
import { logger } from '../utils/logger.js';
export const authRouter = Router();
authRouter.post('/start', async (req, res, next) => {
    try {
        if (isPolling()) {
            res.status(409).json({ error: 'Device code flow already in progress' });
            return;
        }
        logger.info('Starting device code flow');
        const { codeInfo } = await startDeviceCodeFlow();
        res.json(codeInfo);
    }
    catch (err) {
        next(err);
    }
});
authRouter.get('/status', async (req, res, next) => {
    try {
        const authenticated = isAuthenticated();
        const polling = isPolling();
        let userEmail = null;
        if (authenticated) {
            try {
                const client = getGraphClient();
                const user = await client
                    .api('/me')
                    .select('mail,userPrincipalName')
                    .get();
                userEmail = user.mail ?? user.userPrincipalName ?? null;
            }
            catch (err) {
                logger.warn('Could not fetch user email for status', { error: err });
            }
        }
        res.json({ authenticated, polling, userEmail });
    }
    catch (err) {
        next(err);
    }
});
