import { Router } from 'express';
import { listRecentFiles, listSites, listDrives, listFiles, } from '../graph/sharepoint.js';
import { isAuthenticated } from '../auth/tokenRefresher.js';
import { logger } from '../utils/logger.js';
export const sharepointRouter = Router();
function authGuard(req, res, next) {
    if (!isAuthenticated()) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    next();
}
sharepointRouter.use(authGuard);
sharepointRouter.get('/recent', async (req, res, next) => {
    try {
        const countParam = req.query.count;
        const count = countParam ? parseInt(countParam, 10) : 20;
        logger.debug('GET /api/sharepoint/recent', { count });
        const files = await listRecentFiles(count);
        res.json(files);
    }
    catch (err) {
        next(err);
    }
});
sharepointRouter.get('/sites', async (req, res, next) => {
    try {
        logger.debug('GET /api/sharepoint/sites');
        const sites = await listSites();
        res.json(sites);
    }
    catch (err) {
        next(err);
    }
});
sharepointRouter.get('/drives', async (req, res, next) => {
    try {
        const siteId = req.query.siteId;
        if (!siteId) {
            res.status(400).json({ error: 'siteId query parameter is required' });
            return;
        }
        logger.debug('GET /api/sharepoint/drives', { siteId });
        const drives = await listDrives(siteId);
        res.json(drives);
    }
    catch (err) {
        next(err);
    }
});
sharepointRouter.get('/files', async (req, res, next) => {
    try {
        const driveId = req.query.driveId;
        if (!driveId) {
            res.status(400).json({ error: 'driveId query parameter is required' });
            return;
        }
        logger.debug('GET /api/sharepoint/files', { driveId });
        const files = await listFiles(driveId);
        res.json(files);
    }
    catch (err) {
        next(err);
    }
});
