import { logger } from '../utils/logger.js';
export function errorHandler(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    const status = err.status ?? err.statusCode ?? 500;
    const message = err.message ?? 'Internal Server Error';
    logger.error('Unhandled error', {
        status,
        message,
        path: req.path,
        method: req.method,
        stack: err.stack,
    });
    res.status(status).json({
        error: message,
        status,
    });
}
