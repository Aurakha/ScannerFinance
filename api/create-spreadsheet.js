/**
 * Vercel Serverless Function: Membuat Google Spreadsheet langsung di Google Drive
 */
module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { xlsContent, csvContent, title } = req.body || {};
  const contentToUpload = xlsContent || csvContent;

  if (!contentToUpload) {
    return res.status(400).json({ error: 'xlsContent or csvContent is required' });
  }

  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken =
    process.env.EXPO_PUBLIC_GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(500).json({ error: 'Google Drive credentials not configured in environment variables' });
  }

  try {
    // 1. Dapatkan access token baru via Refresh Token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Failed to get Google access token:', tokenData);
      return res.status(500).json({ error: 'Gagal mendapatkan Google access token', details: tokenData });
    }

    const token = tokenData.access_token;
    const sheetName = title || `Rekapitulasi_Pengeluaran_${Date.now()}`;

    // 2. Upload XLS ke Google Drive dan convert otomatis ke Google Spreadsheet (lengkap dengan warna & border)
    const boundary = '-------sheetsboundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: sheetName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    };

    const isXls = Boolean(xlsContent) || contentToUpload.includes('<table') || contentToUpload.includes('<html');
    const uploadMime = isXls ? 'application/vnd.ms-excel; charset=UTF-8' : 'text/csv; charset=UTF-8';

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${uploadMime}\r\n\r\n` +
      contentToUpload +
      closeDelimiter;

    const driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      console.error('Google Drive API error:', errText);
      return res.status(500).json({ error: 'Google Drive upload failed', details: errText });
    }

    const fileData = await driveRes.json();
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${fileData.id}/edit`;

    // 3. Set izin agar bisa dibuka / diedit
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'anyone',
        }),
      });
    } catch (pErr) {
      console.warn('Set permission notice:', pErr);
    }

    return res.status(200).json({
      success: true,
      fileId: fileData.id,
      name: fileData.name,
      spreadsheetUrl: spreadsheetUrl,
    });
  } catch (error) {
    console.error('Create spreadsheet serverless error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
