/**
 * Vercel Serverless Function: Upload foto struk langsung ke Google Drive folder "ScanFinance Receipts"
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

  const { base64Image, fileName, mimeType } = req.body || {};

  if (!base64Image) {
    return res.status(400).json({ error: 'base64Image is required' });
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
    let cleanFileName = fileName;
    if (!cleanFileName) {
      const today = new Date();
      const day = today.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const month = monthNames[today.getMonth()];
      const year = String(today.getFullYear()).slice(-2);
      const timeSuffix = `${String(today.getHours()).padStart(2, '0')}${String(today.getMinutes()).padStart(2, '0')}`;
      const uName = (req.body?.userName || 'user').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      cleanFileName = `${day}-${month}-${year}_${uName}_${timeSuffix}.jpg`;
    }
    const cleanMime = mimeType || 'image/jpeg';

    // 2. Cari atau buat folder "ScanFinance Receipts"
    let folderId = null;
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          "name='ScanFinance Receipts' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        )}&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          folderId = searchData.files[0].id;
        }
      }

      if (!folderId) {
        const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'ScanFinance Receipts',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        if (createFolderRes.ok) {
          const folderData = await createFolderRes.json();
          folderId = folderData.id;
        }
      }
    } catch (e) {
      console.warn('Folder find/create error:', e);
    }

    // 3. Upload gambar via Multipart
    const boundary = '-------uploadboundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: cleanFileName,
      mimeType: cleanMime,
      description: 'Foto struk belanja ScanFinance AI',
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${cleanMime}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Image +
      closeDelimiter;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      console.error('Google Drive image upload failed:', uploadRes.status, errBody);
      return res.status(500).json({ error: 'Image upload failed', details: errBody });
    }

    const data = await uploadRes.json();

    // 4. Set public read permission agar thumbnail foto bisa tampil di aplikasi
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch {}

    return res.status(200).json({
      success: true,
      fileId: data.id,
      name: data.name,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    });
  } catch (error) {
    console.error('Upload receipt serverless error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
