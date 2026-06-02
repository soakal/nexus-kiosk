import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve to server/data (matches boardService.ts). Two '..' segments:
// dev  src/auth -> src -> server -> server/data
// prod dist/auth -> dist -> server -> server/data
const TOKEN_FILE_PATH = path.resolve(__dirname, '..', '..', 'data', 'tokens.json');

export interface TokenData {
  refreshToken: string;
  accessToken: string;
  expiresOn: number;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is required');
  }
  return crypto.scryptSync(secret, 'nexus-kiosk-salt', 32);
}

function encrypt(plaintext: string): { iv: string; data: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    iv: iv.toString('hex'),
    data: encrypted,
  };
}

function decrypt(iv: string, encryptedData: string): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key,
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function saveTokens(data: TokenData): void {
  const plaintext = JSON.stringify(data);
  const encrypted = encrypt(plaintext);

  const dir = path.dirname(TOKEN_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Atomic write: temp file + rename so a crash mid-write can't corrupt the
  // token file (which would lock the kiosk out of auth).
  const tmpPath = TOKEN_FILE_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(encrypted), 'utf8');
  fs.renameSync(tmpPath, TOKEN_FILE_PATH);
  logger.info('Tokens saved to disk');
}

export function loadTokens(): TokenData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE_PATH)) {
      logger.debug('No token file found');
      return null;
    }

    const raw = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
    const { iv, data } = JSON.parse(raw) as { iv: string; data: string };
    const plaintext = decrypt(iv, data);
    const tokenData = JSON.parse(plaintext) as TokenData;
    logger.info('Tokens loaded from disk');
    return tokenData;
  } catch (err) {
    logger.error('Failed to load tokens', { error: err });
    return null;
  }
}
