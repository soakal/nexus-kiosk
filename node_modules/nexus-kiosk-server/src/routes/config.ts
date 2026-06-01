import { Router, Request, Response, NextFunction } from 'express';
import { getConfig, updateConfig, AppConfig } from '../services/configService.js';
import { isAuthenticated } from '../auth/tokenRefresher.js';
import { logger } from '../utils/logger.js';

export const configRouter = Router();

configRouter.get(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      logger.debug('GET /api/config');
      const config = getConfig();
      res.json(config);
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
      const partial = req.body as Partial<AppConfig>;
      const updated = updateConfig(partial);
      res.json(updated);
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
