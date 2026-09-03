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

    // 2. Tentukan Tahun, Bulan (09 - September), dan Tanggal (Tanggal 03) sesuai instruksi user
    const INDONESIAN_MONTH_NAMES = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    let targetDate = null;
    if (req.body?.receiptDate || req.body?.transactionDate) {
      const parsed = new Date(req.body.receiptDate || req.body.transactionDate);
      if (!isNaN(parsed.getTime())) targetDate = parsed;
    }
    if (!targetDate && cleanFileName) {
      const match = cleanFileName.match(/^(\d{1,2})-(Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)-(\d{2,4})/i);
      if (match) {
        const day = parseInt(match[1], 10);
        const mStr = match[2].toLowerCase();
        let yr = parseInt(match[3], 10);
        if (yr < 100) yr += 2000;
        const mMap = {
          jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4,
          jun: 5, jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9,
          nov: 10, des: 11, dec: 11
        };
        if (mMap[mStr] !== undefined) {
          targetDate = new Date(yr, mMap[mStr], day);
        }
      }
    }
    if (!targetDate) {
      targetDate = new Date();
    }

    const yearFolderName = String(targetDate.getFullYear());
    const monthNum = String(targetDate.getMonth() + 1).padStart(2, '0');
    const monthName = INDONESIAN_MONTH_NAMES[targetDate.getMonth()] || 'Januari';
    const monthFolderName = `${monthNum} - ${monthName}`;
    const dayNum = String(targetDate.getDate()).padStart(2, '0');
    const dateFolderName = `Tanggal ${dayNum}`;

    // 3. Cari atau buat hierarki folder on-demand: ScanFinance -> Foto Struk -> [Tahun] -> [Bulan] -> [Tanggal]
    let folderId = null;
    try {
      const getOrCreateFolder = async (name, parentId = null) => {
        let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        if (parentId) {
          q += ` and '${parentId}' in parents`;
        }
        const sRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.files && sData.files.length > 0) {
            return sData.files[0].id;
          }
        }
        const createPayload = {
          name,
          mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) {
          createPayload.parents = [parentId];
        }
        const cRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createPayload),
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          return cData.id;
        }
        return null;
      };

      const rootId = await getOrCreateFolder('ScanFinance');
      const fotoStrukId = await getOrCreateFolder('Foto Struk', rootId);
      const yearFolderId = await getOrCreateFolder(yearFolderName, fotoStrukId);
      const monthFolderId = await getOrCreateFolder(monthFolderName, yearFolderId);
      folderId = await getOrCreateFolder(dateFolderName, monthFolderId);
    } catch (fErr) {
      console.warn('Folder find/create notice:', fErr);
    }

    // 3. Upload gambar via Multipart
    const boundary = '-------receiptboundary' + Date.now();
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
