import { Router } from 'express';
import { getConfig, updateConfig } from '../services/configService.js';
import { isAuthenticated } from '../auth/tokenRefresher.js';
import { logger } from '../utils/logger.js';
export const configRouter = Router();
configRouter.get('/', (req, res, next) => {
    try {
        logger.debug('GET /api/config');
        const config = getConfig();
        res.json(config);
    }
    catch (err) {
        next(err);
    }
});
configRouter.post('/', (req, res, next) => {
    try {
        logger.debug('POST /api/config');
        const partial = req.body;
        const updated = updateConfig(partial);
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
configRouter.get('/health', (req, res, next) => {
    try {
        res.json({
            status: 'ok',
            authenticated: isAuthenticated(),
            uptime: process.uptime(),
        });
    }
    catch (err) {
        next(err);
    }
});
