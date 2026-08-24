import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMoodForDate, saveMood, type MoodEntry, type SaveMoodPayload } from '../services/api/moodApi';
import { moodQueryKey } from './queryKeys';

export function useMoodForDate(date: string) {
  return useQuery({
    queryKey: moodQueryKey(date),
    queryFn: () => fetchMoodForDate(date),
    enabled: Boolean(date),
  });
}

export function useSaveMoodMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveMoodPayload): Promise<MoodEntry> => saveMood(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: moodQueryKey(variables.entry_date) });
    },
  });
}
