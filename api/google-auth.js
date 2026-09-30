const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let cachedToken = null;
let tokenExpiresAt = 0;

// Auto-load .env jika belum ter-load
try {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((l) => {
      const line = l.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const k = line.substring(0, idx).trim();
        const v = line.substring(idx + 1).trim();
        if (k && !process.env[k]) process.env[k] = v;
      }
    });
  }
} catch (e) {}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Mendapatkan Access Token Google Drive via OAuth Refresh Token (Prioritas 1 untuk akun personal)
 * atau Service Account (Fallback 2).
 */
async function getGoogleAccessToken() {
  // Gunakan cached token jika masih valid (buffer 60 detik)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  // 1. PRIORITAS UTAMA: OAUTH REFRESH TOKEN (Menggunakan kuota penyimpanan akun Google Drive user)
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_REFRESH_TOKEN || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        cachedToken = data.access_token;
        tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        console.log('✅ Google Drive token refreshed via OAuth Refresh Token');
        return cachedToken;
      }
      console.warn('OAuth refresh token error:', data);
    } catch (oauthErr) {
      console.warn('OAuth error:', oauthErr);
    }
  }

  // 2. FALLBACK KE SERVICE ACCOUNT
  let serviceAccount = null;
  const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.EXPO_PUBLIC_GOOGLE_SERVICE_ACCOUNT_KEY;
  if (envKey) {
    try {
      const decoded = envKey.startsWith('{') ? envKey : Buffer.from(envKey, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } catch (e) {}
  }

  if (serviceAccount && serviceAccount.client_email && serviceAccount.private_key) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: 'RS256', typ: 'JWT' };
      const claimSet = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      };

      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
      const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signatureInput);
      const signature = signer.sign(serviceAccount.private_key, 'base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const jwt = `${signatureInput}.${signature}`;

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }).toString(),
      });

      const tokenData = await res.json();
      if (res.ok && tokenData.access_token) {
        cachedToken = tokenData.access_token;
        tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
        console.log('✅ Google Drive token obtained via Service Account');
        return cachedToken;
      }
    } catch (saErr) {
      console.warn('Service account authentication error:', saErr);
    }
  }

  throw new Error('Tidak ada kredensial Google Drive yang valid (OAuth Refresh Token atau Service Account).');
}

module.exports = {
  getGoogleAccessToken,
};
