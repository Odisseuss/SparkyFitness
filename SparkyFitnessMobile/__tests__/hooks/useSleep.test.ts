import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useSleepEntries,
  useSaveSleepEntryMutation,
  useUpdateSleepEntryMutation,
  useDeleteSleepEntryMutation,
} from '../../src/hooks/useSleep';
import { fetchSleepEntries, saveSleepEntry, updateSleepEntry, deleteSleepEntry } from '../../src/services/api/sleepApi';
import { createTestQueryClient, createQueryWrapper, type QueryClient } from './queryTestUtils';

jest.mock('../../src/services/api/sleepApi', () => ({
  fetchSleepEntries: jest.fn(),
  saveSleepEntry: jest.fn(),
  updateSleepEntry: jest.fn(),
  deleteSleepEntry: jest.fn(),
}));

const mockFetchSleepEntries = fetchSleepEntries as jest.MockedFunction<typeof fetchSleepEntries>;
const mockSaveSleepEntry = saveSleepEntry as jest.MockedFunction<typeof saveSleepEntry>;
const mockUpdateSleepEntry = updateSleepEntry as jest.MockedFunction<typeof updateSleepEntry>;
const mockDeleteSleepEntry = deleteSleepEntry as jest.MockedFunction<typeof deleteSleepEntry>;

describe('useSleepEntries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns the fetched entries', async () => {
    const entries = [{ id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' }];
    mockFetchSleepEntries.mockResolvedValue(entries);

    const { result } = renderHook(() => useSleepEntries('2026-08-24', '2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(entries);
  });
});

describe('sleep mutations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('useSaveSleepEntryMutation invalidates sleep entries on success', async () => {
    mockSaveSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 0, source: 'manual' });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveSleepEntryMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 0, record_timezone: 'UTC' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['sleepEntries'] }));
  });

  test('useUpdateSleepEntryMutation calls updateSleepEntry with id and payload', async () => {
    mockUpdateSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 0, source: 'manual' });

    const { result } = renderHook(() => useUpdateSleepEntryMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ id: 's1', payload: { bedtime: '', wake_time: '', duration_in_seconds: 0, record_timezone: 'UTC' } });
    });

    expect(mockUpdateSleepEntry).toHaveBeenCalledWith('s1', { bedtime: '', wake_time: '', duration_in_seconds: 0, record_timezone: 'UTC' });
  });

  test('useDeleteSleepEntryMutation calls deleteSleepEntry with id', async () => {
    mockDeleteSleepEntry.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteSleepEntryMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync('s1');
    });

    expect(mockDeleteSleepEntry).toHaveBeenCalledWith('s1');
  });
});
