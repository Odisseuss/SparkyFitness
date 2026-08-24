import { apiFetch } from './apiClient';
import { ApiError } from './errors';

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

/** Returns null when the user has no mood entry for that date (server 404), rethrows any other error. */
export const fetchMoodForDate = async (date: string): Promise<MoodEntry | null> => {
  try {
    return await apiFetch<MoodEntry>({
      endpoint: `/api/mood/date/${encodeURIComponent(date)}`,
      serviceName: 'Mood API',
      operation: 'fetch mood for date',
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
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
