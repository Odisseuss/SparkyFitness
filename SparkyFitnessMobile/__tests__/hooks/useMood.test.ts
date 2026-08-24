import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useMoodForDate, useSaveMoodMutation } from '../../src/hooks/useMood';
import { fetchMoodForDate, saveMood } from '../../src/services/api/moodApi';
import { createTestQueryClient, createQueryWrapper, type QueryClient } from './queryTestUtils';

jest.mock('../../src/services/api/moodApi', () => ({
  fetchMoodForDate: jest.fn(),
  saveMood: jest.fn(),
}));

const mockFetchMoodForDate = fetchMoodForDate as jest.MockedFunction<typeof fetchMoodForDate>;
const mockSaveMood = saveMood as jest.MockedFunction<typeof saveMood>;

describe('useMoodForDate', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns the fetched mood entry', async () => {
    mockFetchMoodForDate.mockResolvedValue({ id: 'm1', mood_value: 60, mood_tags: ['calm'], notes: '', entry_date: '2026-08-24' });

    const { result } = renderHook(() => useMoodForDate('2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: 'm1', mood_value: 60, mood_tags: ['calm'], notes: '', entry_date: '2026-08-24' });
    expect(mockFetchMoodForDate).toHaveBeenCalledWith('2026-08-24');
  });

  test('returns null data when there is no entry for the date', async () => {
    mockFetchMoodForDate.mockResolvedValue(null);

    const { result } = renderHook(() => useMoodForDate('2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });
});

describe('useSaveMoodMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('calls saveMood and invalidates the date query on success', async () => {
    const savedEntry = { id: 'm1', mood_value: 70, mood_tags: ['confident'], notes: '', entry_date: '2026-08-24' };
    mockSaveMood.mockResolvedValue(savedEntry);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveMoodMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ mood_value: 70, mood_tags: ['confident'], notes: '', entry_date: '2026-08-24' });
    });

    expect(mockSaveMood).toHaveBeenCalledWith({ mood_value: 70, mood_tags: ['confident'], notes: '', entry_date: '2026-08-24' });
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['mood', '2026-08-24'] }));
  });
});
