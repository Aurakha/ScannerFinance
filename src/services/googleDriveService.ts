import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const GDRIVE_SETTINGS_KEY = '@scanfinance_gdrive_settings';

const ENV_GDRIVE_TOKEN = process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ACCESS_TOKEN || '';

export interface GoogleDriveSettings {
  isEnabled: boolean;
  accessToken?: string;
  folderId?: string;
  folderName: string;
}

export const defaultGDriveSettings: GoogleDriveSettings = {
  isEnabled: Boolean(ENV_GDRIVE_TOKEN),
  accessToken: ENV_GDRIVE_TOKEN,
  folderId: '',
  folderName: 'ScanFinance Receipts',
};

const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

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
        isEnabled: parsed.isEnabled !== undefined ? parsed.isEnabled : Boolean(ENV_GDRIVE_TOKEN),
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
 * Upload gambar struk ke Google Drive via REST API Multipart Upload
 */
export async function uploadReceiptToGoogleDrive(
  base64Image: string,
  fileName: string,
  mimeType = 'image/jpeg'
): Promise<{ fileId: string; webViewLink: string; webContentLink?: string } | null> {
  const settings = await getGoogleDriveSettings();
  const token = settings.accessToken || ENV_GDRIVE_TOKEN;

  if (!token) {
    console.log('Google Drive upload skipped: Token not configured.');
    return null;
  }

  try {
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: mimeType,
      description: 'Foto struk belanja diproses oleh ScanFinance AI',
    };

    if (settings.folderId) {
      metadata.parents = [settings.folderId];
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
      const errorText = await response.text();
      throw new Error(`Google Drive API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      fileId: data.id,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
      webContentLink: data.webContentLink,
    };
  } catch (err: any) {
    console.warn('Google Drive Upload Failed:', err.message);
    throw err;
  }
}
