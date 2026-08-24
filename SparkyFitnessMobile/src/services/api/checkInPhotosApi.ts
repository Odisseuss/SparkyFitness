import { File } from 'expo-file-system';
import { apiFetch, normalizeUrl } from './apiClient';
import { ApiError } from './errors';
import { getActiveServerConfig, proxyHeadersToRecord } from '../storage';
import { getAuthHeaders, notifySessionExpired } from './authService';
import { addLog } from '../LogService';
import { UPLOAD_TIMEOUT_MS, fetchWithTimeout } from '../../utils/concurrency';

export type PhotoType = 'front' | 'back' | 'side';

export interface CheckInPhoto {
  id: string;
  user_id: string;
  check_in_measurement_id: string | null;
  entry_date: string;
  photo_type: PhotoType;
  file_path: string;
  created_at: string;
}

export const fetchPhotoDates = (): Promise<string[]> =>
  apiFetch<string[]>({
    endpoint: '/api/measurements/check-in-photos/dates',
    serviceName: 'Check-In Photos API',
    operation: 'fetch photo dates',
  });

export const fetchPhotosForDate = (date: string): Promise<CheckInPhoto[]> =>
  apiFetch<CheckInPhoto[]>({
    endpoint: `/api/measurements/check-in-photos/${encodeURIComponent(date)}`,
    serviceName: 'Check-In Photos API',
    operation: 'fetch photos for date',
  });

export async function uploadPhoto(date: string, type: PhotoType, uri: string): Promise<CheckInPhoto> {
  const config = await getActiveServerConfig();
  if (!config) throw new Error('Server configuration not found.');
  const baseUrl = normalizeUrl(config.url);

  const form = new FormData();
  // Global fetch is expo/fetch (WinterCG) under Expo's winter runtime, which
  // rejects React Native's `{uri, name, type}` FormData parts with
  // "Unsupported FormDataPart implementation". expo-file-system's File
  // implements Blob, which expo/fetch serializes correctly.
  form.append('photo', new File(uri));

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/api/measurements/check-in-photos/${encodeURIComponent(date)}/${type}`,
      {
        method: 'POST',
        headers: {
          ...proxyHeadersToRecord(config.proxyHeaders),
          ...getAuthHeaders(config),
          // Multer sets the multipart boundary itself — do NOT set Content-Type manually.
        },
        body: form,
      },
      UPLOAD_TIMEOUT_MS,
    );
  } catch (err) {
    addLog('[Check-In Photos API] Photo upload failed without a response', 'ERROR', [String(err)]);
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401 && config.authType === 'session') {
      notifySessionExpired(config.id);
    }
    const text = await response.text();
    addLog('[Check-In Photos API] Failed to upload photo', 'ERROR', [text]);
    throw new ApiError(`Server error: ${response.status} - ${text}`, response.status, text);
  }

  return response.json();
}

export const deletePhoto = (id: string): Promise<void> =>
  apiFetch<void>({
    endpoint: `/api/measurements/check-in-photos/photo/${encodeURIComponent(id)}`,
    serviceName: 'Check-In Photos API',
    operation: 'delete photo',
    method: 'DELETE',
  });

/**
 * Builds an authenticated `<SafeImage>` source for a photo id. Check-in
 * photos are private and served through the authenticated
 * `GET .../file/:id` route (unlike public-static food/exercise images), so
 * the source needs the same Authorization/proxy headers `apiFetch` sends.
 */
export async function buildPhotoImageSource(
  photoId: string,
): Promise<{ uri: string; headers: Record<string, string> } | null> {
  const config = await getActiveServerConfig();
  if (!config) return null;
  const baseUrl = normalizeUrl(config.url);
  return {
    uri: `${baseUrl}/api/measurements/check-in-photos/file/${encodeURIComponent(photoId)}`,
    headers: {
      ...proxyHeadersToRecord(config.proxyHeaders),
      ...getAuthHeaders(config),
    },
  };
}
