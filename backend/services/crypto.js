const crypto = require('crypto');

// Derive a 32-byte key from JWT_SECRET or ENCRYPTION_KEY using SHA-256
const SECRET = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-secret-change-me';
const KEY = crypto.createHash('sha256').update(String(SECRET)).digest();
const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:';

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: "enc:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext; // already encrypted

  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with encrypt().
 * If the string does not start with "enc:", returns it as-is for backward compatibility.
 */
function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // plain text fallback

  try {
    const parts = ciphertext.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return ciphertext;

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return ciphertext;
  }
}

/**
 * Masks an API key for safe UI display (e.g., "sk-ant...98ab")
 */
function maskApiKey(key) {
  if (!key) return null;
  const decrypted = decrypt(key);
  if (!decrypted || decrypted.length < 8) return '••••••••';
  const start = decrypted.slice(0, 4);
  const end = decrypted.slice(-4);
  return `${start}••••••••${end}`;
}

module.exports = { encrypt, decrypt, maskApiKey };
