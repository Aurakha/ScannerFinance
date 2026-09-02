import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';

const GDRIVE_SETTINGS_KEY = '@scanfinance_gdrive_settings';

// Legacy: direct access token (akan expired)
const ENV_GDRIVE_TOKEN = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ACCESS_TOKEN || '';

// OAuth2 Refresh Token flow (tidak expired)
const ENV_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || '';
const ENV_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_SECRET || '';
const ENV_REFRESH_TOKEN = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_REFRESH_TOKEN || '';

export interface GoogleDriveSettings {
  isEnabled: boolean;
  accessToken?: string;
  folderId?: string;
  folderName: string;
}

export const defaultGDriveSettings: GoogleDriveSettings = {
  isEnabled: Boolean(ENV_GDRIVE_TOKEN) || Boolean(ENV_REFRESH_TOKEN),
  accessToken: ENV_GDRIVE_TOKEN,
  folderId: '',
  folderName: 'ScanFinance Receipts',
};

const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

// In-memory cache untuk access token yang di-refresh
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Mendapatkan access token yang valid.
 * Jika ada refresh token, akan otomatis generate access token baru saat expired.
 * Jika hanya ada access token langsung, gunakan itu (bisa expired).
 */
async function getValidAccessToken(): Promise<string | null> {
  // 1. Cek apakah punya refresh token flow
  if (ENV_CLIENT_ID && ENV_CLIENT_SECRET && ENV_REFRESH_TOKEN) {
    // Cek apakah cached token masih valid (dengan buffer 60 detik)
    if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
      return cachedAccessToken;
    }

    // Refresh access token menggunakan refresh token
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: ENV_CLIENT_ID,
          client_secret: ENV_CLIENT_SECRET,
          refresh_token: ENV_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (response.ok) {
        const data = await response.json();
        cachedAccessToken = data.access_token;
        // expires_in biasanya 3600 detik (1 jam)
        tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        console.log('✅ Google Drive access token refreshed successfully');
        return cachedAccessToken;
      } else {
        const err = await response.json();
        console.warn('⚠️ Failed to refresh Google Drive token:', err);
        return null;
      }
    } catch (e) {
      console.warn('⚠️ Error refreshing Google Drive token:', e);
      return null;
    }
  }

  // 2. Fallback: gunakan direct access token (legacy, bisa expired)
  const settings = await getGoogleDriveSettings();
  return settings.accessToken || ENV_GDRIVE_TOKEN || null;
}

/**
 * Ambil konfigurasi Google Drive dari storage lokal atau default .env
 */
export async function getGoogleDriveSettings(): Promise<GoogleDriveSettings> {
  if (isSSR) return defaultGDriveSettings;
  try {
    const raw = await AsyncStorage.getItem(GDRIVE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultGDriveSettings,
        ...parsed,
        accessToken: parsed.accessToken || ENV_GDRIVE_TOKEN,
        isEnabled: parsed.isEnabled !== undefined ? parsed.isEnabled : (Boolean(ENV_GDRIVE_TOKEN) || Boolean(ENV_REFRESH_TOKEN)),
      };
    }
  } catch (err) {
    console.warn('Failed to load Google Drive settings:', err);
  }
  return defaultGDriveSettings;
}

/**
 * Simpan konfigurasi Google Drive
 */
export async function saveGoogleDriveSettings(
  settings: Partial<GoogleDriveSettings>
): Promise<GoogleDriveSettings> {
  const current = await getGoogleDriveSettings();
  const updated: GoogleDriveSettings = { ...current, ...settings };
  if (!isSSR) {
    try {
      await AsyncStorage.setItem(GDRIVE_SETTINGS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save Google Drive settings:', err);
    }
  }
  return updated;
}

/**
 * Cari atau buat folder "ScanFinance Receipts" di Google Drive
 */
async function getOrCreateFolder(token: string, folderName: string): Promise<string | null> {
  try {
    // Cek apakah folder sudah ada
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Buat folder baru
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
  } catch (e) {
    console.warn('Error getting/creating Drive folder:', e);
  }
  return null;
}

/**
 * Upload gambar struk ke Google Drive (Serverless API / Direct REST API)
 */
export async function uploadReceiptToGoogleDrive(
  base64Image: string,
  fileName: string,
  mimeType = 'image/jpeg'
): Promise<{ fileId: string; webViewLink: string; webContentLink?: string } | null> {
  // 1. Coba lewat Vercel Serverless API jika di Web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const apiRes = await fetch('/api/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image, fileName, mimeType }),
      });
      if (apiRes.ok) {
        const result = await apiRes.json();
        if (result.success && result.webViewLink) {
          console.log('✅ Foto struk berhasil diupload via Serverless API:', result.name);
          return {
            fileId: result.fileId,
            webViewLink: result.webViewLink,
          };
        }
      }
    } catch (apiErr) {
      console.warn('Serverless image upload error, trying direct:', apiErr);
    }
  }

  // 2. Fallback: Direct API
  const token = await getValidAccessToken();
  if (!token) {
    console.warn('⚠️ Tidak ada Google Drive token yang valid. Foto tidak diupload.');
    return null;
  }

  try {
    const settings = await getGoogleDriveSettings();
    let folderId = settings.folderId;
    if (!folderId) {
      folderId = (await getOrCreateFolder(token, settings.folderName || 'ScanFinance Receipts')) ?? undefined;
      if (folderId) {
        await saveGoogleDriveSettings({ folderId });
      }
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: mimeType,
      description: 'Foto struk belanja diproses oleh ScanFinance AI',
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Image +
      closeDelimiter;

    const response = await fetch(
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

    if (!response.ok) {
      const errBody = await response.text();
      console.warn('Google Drive upload failed:', response.status, errBody);
      return null;
    }

    const data = await response.json();
    console.log('✅ Foto struk berhasil diupload ke Google Drive:', data.name);

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

    return {
      fileId: data.id,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
      webContentLink: data.webContentLink,
    };
  } catch (err) {
    console.warn('Google Drive upload error:', err);
    return null;
  }
}

/**
 * Membuat dan mengekspor laporan rekapitulasi langsung ke Google Spreadsheet di Google Drive
 */
export async function exportToGoogleSpreadsheet(
  content: string,
  sheetTitle = 'Rekapitulasi_Pengeluaran_ScanFinance'
): Promise<{ fileId?: string; spreadsheetUrl: string; isDirectCloud: boolean }> {
  const isXls = content.includes('<table') || content.includes('<html');

  // 1. Coba lewat Vercel Serverless API jika di Web (bebas CORS & langsung berformat rapi)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const apiRes = await fetch('/api/create-spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xlsContent: isXls ? content : undefined,
          csvContent: !isXls ? content : undefined,
          title: sheetTitle,
        }),
      });
      if (apiRes.ok) {
        const result = await apiRes.json();
        if (result.success && result.spreadsheetUrl) {
          console.log('✅ Spreadsheet berformat berhasil dibuat via Serverless API:', result.name);
          return {
            fileId: result.fileId,
            spreadsheetUrl: result.spreadsheetUrl,
            isDirectCloud: true,
          };
        }
      }
    } catch (apiErr) {
      console.warn('Serverless spreadsheet creation error, trying direct:', apiErr);
    }
  }

  // 2. Fallback: Direct API
  const token = await getValidAccessToken();

  if (token) {
    try {
      const settings = await getGoogleDriveSettings();
      const boundary = '-------sheetsboundary31415926';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata: Record<string, any> = {
        name: sheetTitle,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      };

      if (settings.folderId) {
        metadata.parents = [settings.folderId];
      }

      const uploadMime = isXls ? 'application/vnd.ms-excel; charset=UTF-8' : 'text/csv; charset=UTF-8';

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${uploadMime}\r\n\r\n` +
        content +
        closeDelimiter;

      const response = await fetch(
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

      if (response.ok) {
        const data = await response.json();
        const spreadsheetUrl =
          data.webViewLink || `https://docs.google.com/spreadsheets/d/${data.id}/edit`;

        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
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
        } catch {}

        console.log('✅ Spreadsheet berhasil dibuat di Google Drive:', data.name);
        return {
          fileId: data.id,
          spreadsheetUrl,
          isDirectCloud: true,
        };
      }
    } catch (e) {
      console.warn('Direct Google Drive upload error, falling back to Sheets New:', e);
    }
  }

  // 3. Fallback Instan
  return {
    spreadsheetUrl: 'https://sheets.new',
    isDirectCloud: false,
  };
}
