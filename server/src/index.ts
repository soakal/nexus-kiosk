import 'dotenv/config';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import { initializeTokens, startRefreshCron, isAuthenticated, needsReauthentication } from './auth/tokenRefresher.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { calendarsRouter } from './routes/calendars.js';
import { eventsRouter } from './routes/events.js';
import { configRouter } from './routes/config.js';
import { sharepointRouter } from './routes/sharepoint.js';
import { boardRouter } from './routes/board.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fail fast at boot if required environment is missing, instead of throwing
 * deep inside a request handler or cron job later.
 */
function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const azureDisabled = process.env.DISABLE_AZURE === 'true';
  const missing: string[] = [];

  if (!azureDisabled) {
    if (!process.env.ENCRYPTION_SECRET) missing.push('ENCRYPTION_SECRET');
    if (!process.env.AZURE_TENANT_ID) missing.push('AZURE_TENANT_ID');
    if (!process.env.AZURE_CLIENT_ID) missing.push('AZURE_CLIENT_ID');
  }

  if (isProd && !process.env.CORS_ORIGIN) {
    // Default to same-origin localhost; kiosk is always served from port 3001.
    process.env.CORS_ORIGIN = 'http://localhost:3001';
  }

  if (missing.length > 0) {
    logger.error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Refusing to start. Set them in .env (see .env.example).`
    );
    process.exit(1);
  }
}

validateEnv();

const app = express();

// Security & parsing middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// In production CORS_ORIGIN is required (enforced by validateEnv); never fall
// back to '*' there. Outside production '*' is allowed for local dev convenience.
const corsOrigin =
  process.env.CORS_ORIGIN ??
  (process.env.NODE_ENV === 'production' ? false : '*');

app.use(
  cors({
    origin: corsOrigin,
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
  // Report readiness, not just liveness, so external monitoring can detect the
  // silent auth-failure state (token refresh died, kiosk showing no live data).
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    authenticated: isAuthenticated(),
    needsReauth: needsReauthentication(),
    testMode: process.env.DISABLE_AZURE === 'true',
  });
});

// Static file serving — active whenever client/dist exists (production or explicit NODE_ENV)
import { existsSync } from 'fs';

// Unknown /api/* routes must return JSON 404, never the SPA index.html or a
// redirect to Vite — otherwise the client tries to JSON.parse HTML.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (existsSync(path.join(clientDistPath, 'index.html'))) {
  app.use(express.static(clientDistPath));

  // SPA fallback: serve index.html for any unmatched route
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else if (process.env.NODE_ENV !== 'production') {
  // Dev mode without a built client: redirect SPA routes to the Vite dev server
  // so localhost:3001/board works the same as localhost:5173/board
  app.get('*', (req: Request, res: Response) => {
    res.redirect(`http://localhost:5173${req.path}`);
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
