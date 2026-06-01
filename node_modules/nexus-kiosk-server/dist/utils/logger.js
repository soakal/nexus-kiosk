import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, '..', '..', '..', 'logs');
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.json()),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                return `${timestamp} [${level}]: ${message}${metaStr}`;
            })),
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
        }),
    ],
});
export { logger };
