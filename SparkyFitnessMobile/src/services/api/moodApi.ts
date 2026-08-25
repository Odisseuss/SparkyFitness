import { apiFetch } from './apiClient';

export interface MoodEntry {
  id: string;
  mood_value: number;
  mood_tags: string[];
  notes: string;
  entry_date: string;
}

export interface SaveMoodPayload {
  mood_value: number;
  mood_tags: string[];
  notes: string;
  entry_date: string;
}

/**
 * Returns null when the user has no mood entry for that date. The server's
 * `GET /mood/date/:entryDate` route responds HTTP 200 with an empty `{}`
 * body in that case (not a 404 — see `moodRoutes.ts`), so "no entry" is
 * detected by the absence of an `id` field, not by response status.
 */
export const fetchMoodForDate = async (date: string): Promise<MoodEntry | null> => {
  const result = await apiFetch<Partial<MoodEntry>>({
    endpoint: `/api/mood/date/${encodeURIComponent(date)}`,
    serviceName: 'Mood API',
    operation: 'fetch mood for date',
  });
  return result?.id ? (result as MoodEntry) : null;
};

/** Upserts (create-or-update by entry_date) the user's mood entry for a day. */
export const saveMood = (payload: SaveMoodPayload): Promise<MoodEntry> =>
  apiFetch<MoodEntry>({
    endpoint: '/api/mood',
    serviceName: 'Mood API',
    operation: 'save mood',
    method: 'POST',
    body: payload,
  });
