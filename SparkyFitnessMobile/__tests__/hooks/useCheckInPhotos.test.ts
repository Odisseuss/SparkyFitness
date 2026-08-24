import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useCheckInPhotoDates,
  useCheckInPhotosForDate,
  useUploadCheckInPhotoMutation,
  useDeleteCheckInPhotoMutation,
  useCheckInPhotoImageSource,
} from '../../src/hooks/useCheckInPhotos';
import {
  fetchPhotoDates,
  fetchPhotosForDate,
  uploadPhoto,
  deletePhoto,
  buildPhotoImageSource,
} from '../../src/services/api/checkInPhotosApi';
import { createTestQueryClient, createQueryWrapper, type QueryClient } from './queryTestUtils';

jest.mock('../../src/services/api/checkInPhotosApi', () => ({
  fetchPhotoDates: jest.fn(),
  fetchPhotosForDate: jest.fn(),
  uploadPhoto: jest.fn(),
  deletePhoto: jest.fn(),
  buildPhotoImageSource: jest.fn(),
}));

const mockFetchPhotoDates = fetchPhotoDates as jest.MockedFunction<typeof fetchPhotoDates>;
const mockFetchPhotosForDate = fetchPhotosForDate as jest.MockedFunction<typeof fetchPhotosForDate>;
const mockUploadPhoto = uploadPhoto as jest.MockedFunction<typeof uploadPhoto>;
const mockDeletePhoto = deletePhoto as jest.MockedFunction<typeof deletePhoto>;
const mockBuildPhotoImageSource = buildPhotoImageSource as jest.MockedFunction<typeof buildPhotoImageSource>;

describe('useCheckInPhotoDates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns fetched dates', async () => {
    mockFetchPhotoDates.mockResolvedValue(['2026-08-24']);

    const { result } = renderHook(() => useCheckInPhotoDates(), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(['2026-08-24']);
  });
});

describe('useCheckInPhotosForDate', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('returns fetched photos for the date', async () => {
    const photos = [{ id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front' as const, file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' }];
    mockFetchPhotosForDate.mockResolvedValue(photos);

    const { result } = renderHook(() => useCheckInPhotosForDate('2026-08-24'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(photos);
  });
});

describe('photo mutations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('useUploadCheckInPhotoMutation calls uploadPhoto and invalidates both photo queries', async () => {
    mockUploadPhoto.mockResolvedValue({ id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front', file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUploadCheckInPhotoMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ date: '2026-08-24', type: 'front', uri: 'file:///tmp/x.jpg' });
    });

    expect(mockUploadPhoto).toHaveBeenCalledWith('2026-08-24', 'front', 'file:///tmp/x.jpg');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotos', '2026-08-24'] }));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotoDates'] }));
  });

  test('useDeleteCheckInPhotoMutation calls deletePhoto and invalidates the entry date', async () => {
    mockDeletePhoto.mockResolvedValue(undefined);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteCheckInPhotoMutation(), { wrapper: createQueryWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', entryDate: '2026-08-24' });
    });

    expect(mockDeletePhoto).toHaveBeenCalledWith('p1');
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotos', '2026-08-24'] }));
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['checkInPhotoDates'] }));
  });
});

describe('useCheckInPhotoImageSource', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('resolves the built source for a given photo id', async () => {
    mockBuildPhotoImageSource.mockResolvedValue({ uri: 'https://example.com/api/measurements/check-in-photos/file/p1', headers: { Authorization: 'Bearer x' } });

    const { result } = renderHook(() => useCheckInPhotoImageSource('p1'), { wrapper: createQueryWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.source).toEqual({ uri: 'https://example.com/api/measurements/check-in-photos/file/p1', headers: { Authorization: 'Bearer x' } });
  });

  test('returns a null source without calling the API when photoId is undefined', () => {
    const { result } = renderHook(() => useCheckInPhotoImageSource(undefined), { wrapper: createQueryWrapper(queryClient) });

    expect(mockBuildPhotoImageSource).not.toHaveBeenCalled();
    expect(result.current.source).toBeNull();
  });
});
