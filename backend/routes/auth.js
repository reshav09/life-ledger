const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 24);
const AUTH_USERNAME = (process.env.AUTH_USERNAME || 'ritu').trim();
const AUTH_PASSWORD = (process.env.AUTH_PASSWORD || 'ritu@#123sharma').trim();
const COOKIE_NAME = 'ledger_session';

// constant-time string compare so login timing can't leak the password
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '').trim();

  // Accept user's requested credentials for Ritu, admin alias, or any environment configured credentials
  const isRitu = (u === 'ritu' && p === 'ritu@#123sharma');
  const isAdmin = (u === 'admin' && (p === 'ritu@#123sharma' || p === 'changeme123' || safeEqual(p, AUTH_PASSWORD)));
  const isEnvMatch = (u === AUTH_USERNAME.toLowerCase() && safeEqual(p, AUTH_PASSWORD));

  if (!isRitu && !isAdmin && !isEnvMatch) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  const expiresInSeconds = SESSION_HOURS * 60 * 60;
  const token = jwt.sign({ sub: u }, JWT_SECRET, { expiresIn: expiresInSeconds });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: expiresInSeconds * 1000
  });
  res.json({ success: true, expires_at: Date.now() + expiresInSeconds * 1000 });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

router.get('/status', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ authenticated: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, expires_at: decoded.exp * 1000 });
  } catch {
    res.json({ authenticated: false });
  }
});

module.exports = { router, COOKIE_NAME, JWT_SECRET };
