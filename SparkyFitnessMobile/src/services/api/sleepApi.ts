import { apiFetch } from './apiClient';

/** Fields the mobile Sleep tab reads/writes. The server row carries many more
 * health-sync-only fields (stage seconds, SpO2, HRV, etc.) that this client
 * intentionally does not model — manual entries never populate them. */
export interface SleepEntry {
  id: string;
  entry_date: string;
  bedtime: string;
  wake_time: string;
  duration_in_seconds: number;
  source: string;
}

export interface SaveSleepEntryPayload {
  entry_date: string;
  bedtime: string;
  wake_time: string;
  duration_in_seconds: number;
  record_timezone: string;
}

export interface UpdateSleepEntryPayload {
  bedtime: string;
  wake_time: string;
  duration_in_seconds: number;
  record_timezone: string;
}

export const fetchSleepEntries = (startDate: string, endDate: string): Promise<SleepEntry[]> =>
  apiFetch<SleepEntry[]>({
    endpoint: `/api/sleep?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    serviceName: 'Sleep API',
    operation: 'fetch sleep entries',
  });

/** No `stage_events` field — mobile v1 only collects bedtime/wake time. */
export const saveSleepEntry = (payload: SaveSleepEntryPayload): Promise<SleepEntry> =>
  apiFetch<SleepEntry>({
    endpoint: '/api/sleep/manual_entry',
    serviceName: 'Sleep API',
    operation: 'save sleep entry',
    method: 'POST',
    body: payload,
  });

export const updateSleepEntry = (id: string, payload: UpdateSleepEntryPayload): Promise<SleepEntry> =>
  apiFetch<SleepEntry>({
    endpoint: `/api/sleep/${encodeURIComponent(id)}`,
    serviceName: 'Sleep API',
    operation: 'update sleep entry',
    method: 'PUT',
    body: payload,
  });

export const deleteSleepEntry = (id: string): Promise<void> =>
  apiFetch<void>({
    endpoint: `/api/sleep/${encodeURIComponent(id)}`,
    serviceName: 'Sleep API',
    operation: 'delete sleep entry',
    method: 'DELETE',
  });
