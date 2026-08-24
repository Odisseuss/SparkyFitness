import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSleepEntries,
  saveSleepEntry,
  updateSleepEntry,
  deleteSleepEntry,
  type SleepEntry,
  type SaveSleepEntryPayload,
  type UpdateSleepEntryPayload,
} from '../services/api/sleepApi';
import { sleepEntriesQueryKey, sleepEntriesQueryKeyRoot } from './queryKeys';

export function useSleepEntries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: sleepEntriesQueryKey(startDate, endDate),
    queryFn: () => fetchSleepEntries(startDate, endDate),
    enabled: Boolean(startDate) && Boolean(endDate),
  });
}

export function useSaveSleepEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSleepEntryPayload): Promise<SleepEntry> => saveSleepEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sleepEntriesQueryKeyRoot });
    },
  });
}

export function useUpdateSleepEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSleepEntryPayload }): Promise<SleepEntry> =>
      updateSleepEntry(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sleepEntriesQueryKeyRoot });
    },
  });
}

export function useDeleteSleepEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<void> => deleteSleepEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sleepEntriesQueryKeyRoot });
    },
  });
}
