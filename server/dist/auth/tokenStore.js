import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_FILE_PATH = path.resolve(__dirname, '..', '..', '..', 'data', 'tokens.json');
function getEncryptionKey() {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
        throw new Error('ENCRYPTION_SECRET environment variable is required');
    }
    return crypto.scryptSync(secret, 'nexus-kiosk-salt', 32);
}
function encrypt(plaintext) {
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
function decrypt(iv, encryptedData) {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
export function saveTokens(data) {
    const plaintext = JSON.stringify(data);
    const encrypted = encrypt(plaintext);
    const dir = path.dirname(TOKEN_FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(encrypted), 'utf8');
    logger.info('Tokens saved to disk');
}
export function loadTokens() {
    try {
        if (!fs.existsSync(TOKEN_FILE_PATH)) {
            logger.debug('No token file found');
            return null;
        }
        const raw = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
        const { iv, data } = JSON.parse(raw);
        const plaintext = decrypt(iv, data);
        const tokenData = JSON.parse(plaintext);
        logger.info('Tokens loaded from disk');
        return tokenData;
    }
    catch (err) {
        logger.error('Failed to load tokens', { error: err });
        return null;
    }
}
