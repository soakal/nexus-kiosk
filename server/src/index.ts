import 'dotenv/config';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import { initializeTokens, startRefreshCron } from './auth/tokenRefresher.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { calendarsRouter } from './routes/calendars.js';
import { eventsRouter } from './routes/events.js';
import { configRouter } from './routes/config.js';
import { sharepointRouter } from './routes/sharepoint.js';
import { boardRouter } from './routes/board.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & parsing middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/calendars', calendarsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/config', configRouter);
app.use('/api/sharepoint', sharepointRouter);
app.use('/api/board', boardRouter);

// Simple health route (outside configRouter to avoid auth dependency)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Production static file serving for client/dist
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '..', '..', '..', 'client', 'dist');
  app.use(express.static(clientDistPath));

  // SPA fallback: serve index.html for any unmatched route
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handler must be last
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '3001', 10);

  logger.info('Nexus Kiosk server starting up...');

  const authenticated = await initializeTokens();

  if (authenticated) {
    logger.info('Tokens initialized successfully, starting refresh cron');
    startRefreshCron();
  } else {
    logger.warn(
      'Could not initialize tokens from storage — authentication required via /api/auth/start'
    );
  }

  app.listen(port, () => {
    logger.info(`Server listening on port ${port}`, {
      port,
      env: process.env.NODE_ENV ?? 'development',
      authenticated,
    });
  });
}

bootstrap().catch((err: unknown) => {
  logger.error('Fatal error during bootstrap', { error: err });
  process.exit(1);
});
