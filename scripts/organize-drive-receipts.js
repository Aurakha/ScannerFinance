const fs = require('fs');
const path = require('path');

// Baca .env secara native tanpa modul eksternal
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
} catch (e) {}

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_REFRESH_TOKEN || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

const INDONESIAN_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

async function getAccessToken() {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = await tokenRes.json();
  if (!data.access_token) {
    throw new Error('Gagal mendapatkan access token Google: ' + JSON.stringify(data));
  }
  return data.access_token;
}

async function getOrCreateFolder(token, name, parentId = null) {
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
  throw new Error(`Gagal membuat folder '${name}' di parent '${parentId}'`);
}

function parseDateFromFileName(fileName) {
  const match = fileName.match(/^(\d{1,2})-(Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)-(\d{2,4})/i);
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
      const d = new Date(yr, mMap[mStr], day);
      return {
        year: String(d.getFullYear()),
        month: `${String(d.getMonth() + 1).padStart(2, '0')} - ${INDONESIAN_MONTH_NAMES[d.getMonth()]}`,
        day: `Tanggal ${String(d.getDate()).padStart(2, '0')}`,
      };
    }
  }
  // Default fallback to today
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: `${String(now.getMonth() + 1).padStart(2, '0')} - ${INDONESIAN_MONTH_NAMES[now.getMonth()]}`,
    day: `Tanggal ${String(now.getDate()).padStart(2, '0')}`,
  };
}

async function organize() {
  console.log('🔄 Menghubungi Google Drive API...');
  const token = await getAccessToken();
  console.log('✅ Access Token Google Drive berhasil didapatkan.');

  // Cari ScanFinance -> Foto Struk
  const rootId = await getOrCreateFolder(token, 'ScanFinance');
  const fotoStrukId = await getOrCreateFolder(token, 'Foto Struk', rootId);
  console.log(`📁 Folder ScanFinance ID: ${rootId}`);
  console.log(`📁 Folder Foto Struk ID: ${fotoStrukId}`);

  // List semua file yang langsung ada di Foto Struk (bukan folder)
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `'${fotoStrukId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`
    )}&fields=files(id,name,mimeType,createdTime)&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const listData = await listRes.json();
  const files = listData.files || [];
  console.log(`🔍 Ditemukan ${files.length} file struk di dalam folder 'Foto Struk':`);

  if (files.length === 0) {
    console.log('ℹ️ Tidak ada file struk lepas yang perlu dipindahkan.');
    return;
  }

  for (const file of files) {
    const { year, month, day } = parseDateFromFileName(file.name);
    console.log(`\n📄 Memproses file: ${file.name}`);
    console.log(`   Target: ${year} > ${month} > ${day}`);

    // Dapatkan atau buat folder berjenjang
    const yearId = await getOrCreateFolder(token, year, fotoStrukId);
    const monthId = await getOrCreateFolder(token, month, yearId);
    const dayId = await getOrCreateFolder(token, day, monthId);

    // Pindahkan file ke folder dayId dan hapus dari fotoStrukId
    const moveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?addParents=${dayId}&removeParents=${fotoStrukId}&fields=id,parents`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (moveRes.ok) {
      console.log(`   ✅ Berhasil dipindahkan ke folder: ${year} / ${month} / ${day}`);
    } else {
      const errTxt = await moveRes.text();
      console.error(`   ❌ Gagal memindahkan file ${file.name}:`, errTxt);
    }
  }

  console.log('\n🎉 Selesai merapikan semua file struk lama ke dalam struktur folder tahun/bulan/tanggal!');
}

organize().catch((err) => {
  console.error('Terjadi error:', err);
  process.exit(1);
});
