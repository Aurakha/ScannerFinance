/**
 * Script untuk mendapatkan Google Drive OAuth2 Refresh Token.
 *
 * Cara pakai:
 *   1. Isi CLIENT_ID dan CLIENT_SECRET di bawah (dari Google Cloud Console)
 *   2. Jalankan: node scripts/get-google-refresh-token.js
 *   3. Buka URL yang muncul di browser, login, izinkan akses
 *   4. Copy refresh token yang muncul di terminal
 *   5. Paste ke .env sebagai EXPO_PUBLIC_GOOGLE_DRIVE_REFRESH_TOKEN
 */

const http = require('http');
const url = require('url');

// =============================================
// ISI DULU DARI GOOGLE CLOUD CONSOLE:
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'ISI_CLIENT_ID_DISINI';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'ISI_CLIENT_SECRET_DISINI';
// =============================================

const REDIRECT_URI = 'http://localhost:3000/oauth-callback';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

if (CLIENT_ID === 'ISI_CLIENT_ID_DISINI' || CLIENT_SECRET === 'ISI_CLIENT_SECRET_DISINI') {
  console.log('\n❌ Client ID dan Client Secret belum diisi!');
  console.log('');
  console.log('Cara 1 — Edit file ini langsung:');
  console.log('   Buka scripts/get-google-refresh-token.js');
  console.log('   Ganti ISI_CLIENT_ID_DISINI dan ISI_CLIENT_SECRET_DISINI');
  console.log('');
  console.log('Cara 2 — Pakai environment variable:');
  console.log('   set GOOGLE_CLIENT_ID=your_id_here');
  console.log('   set GOOGLE_CLIENT_SECRET=your_secret_here');
  console.log('   node scripts/get-google-refresh-token.js');
  console.log('');
  process.exit(1);
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n🔗 Buka URL berikut di browser:\n');
console.log(authUrl);
console.log('\n⏳ Menunggu callback setelah login...\n');

// Buka browser otomatis jika di Windows
try {
  const { exec } = require('child_process');
  exec(`start "" "${authUrl}"`);
} catch (e) {
  // Abaikan jika gagal membuka browser
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/oauth-callback') {
    const code = parsedUrl.query.code;

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>❌ Tidak ada authorization code</h2>');
      return;
    }

    try {
      // Tukar authorization code dengan access token + refresh token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }).toString(),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.refresh_token) {
        console.log('\n✅ BERHASIL! Refresh Token diperoleh:\n');
        console.log('═══════════════════════════════════════════════');
        console.log(tokenData.refresh_token);
        console.log('═══════════════════════════════════════════════');
        console.log('\n📋 Copy token di atas, lalu paste ke file .env:');
        console.log(`   EXPO_PUBLIC_GOOGLE_DRIVE_REFRESH_TOKEN=${tokenData.refresh_token}`);
        console.log(`   EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID=${CLIENT_ID}`);
        console.log(`   EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log('\n💡 Jangan lupa hapus baris EXPO_PUBLIC_GOOGLE_DRIVE_ACCESS_TOKEN yang lama!\n');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Refresh Token Berhasil!</h1>
            <p>Token sudah muncul di terminal. Copy dan paste ke file <code>.env</code></p>
            <pre style="background: #f1f5f9; padding: 16px; border-radius: 8px; word-break: break-all; text-align: left; max-width: 600px; margin: 20px auto;">${tokenData.refresh_token}</pre>
            <p>Kamu bisa tutup halaman ini.</p>
          </body></html>
        `);
      } else {
        console.log('\n⚠️  Tidak mendapat refresh token. Response:');
        console.log(JSON.stringify(tokenData, null, 2));
        console.log('\nPastikan kamu menambahkan prompt=consent di auth URL.');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>⚠️ Tidak mendapat Refresh Token</h1>
            <p>Cek terminal untuk detail error.</p>
            <pre style="background: #fef2f2; padding: 16px; border-radius: 8px; text-align: left; max-width: 600px; margin: 20px auto;">${JSON.stringify(tokenData, null, 2)}</pre>
          </body></html>
        `);
      }
    } catch (err) {
      console.error('❌ Error saat menukar token:', err);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h2>❌ Error: ${err.message}</h2>`);
    }

    // Tutup server setelah selesai
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 2000);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000, () => {
  console.log('🌐 Server OAuth callback berjalan di http://localhost:3000');
});
