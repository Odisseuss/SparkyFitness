import {
  fetchPhotoDates,
  fetchPhotosForDate,
  uploadPhoto,
  deletePhoto,
  buildPhotoImageSource,
} from '../../src/services/api/checkInPhotosApi';
import { getActiveServerConfig, ServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: jest.requireActual('../../src/services/storage').proxyHeadersToRecord,
}));

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri })),
}));

const mockGetActiveServerConfig = getActiveServerConfig as jest.MockedFunction<typeof getActiveServerConfig>;

describe('checkInPhotosApi', () => {
  const mockFetch = jest.fn();
  const testConfig: ServerConfig = { id: 'test-id', url: 'https://example.com', apiKey: 'test-api-key-12345' };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  test('fetchPhotoDates sends GET to /api/measurements/check-in-photos/dates', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(['2026-08-24', '2026-08-01']) });

    const result = await fetchPhotoDates();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/dates',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual(['2026-08-24', '2026-08-01']);
  });

  test('fetchPhotosForDate sends GET to /api/measurements/check-in-photos/:date', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await fetchPhotosForDate('2026-08-24');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/2026-08-24',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('uploadPhoto sends multipart POST to /api/measurements/check-in-photos/:date/:type', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    const responseData = { id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front', file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(responseData) });

    const result = await uploadPhoto('2026-08-24', 'front', 'file:///tmp/photo.jpg');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/2026-08-24/front',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(result).toEqual(responseData);
  });

  test('deletePhoto sends DELETE to /api/measurements/check-in-photos/photo/:id', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, status: 204, headers: { get: () => '0' } });

    await deletePhoto('p1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/measurements/check-in-photos/photo/p1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  describe('buildPhotoImageSource', () => {
    test('returns a uri with Authorization header when a server is configured', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);

      const source = await buildPhotoImageSource('p1');

      expect(source).toEqual({
        uri: 'https://example.com/api/measurements/check-in-photos/file/p1',
        headers: { Authorization: 'Bearer test-api-key-12345' },
      });
    });

    test('returns null when there is no active server config', async () => {
      mockGetActiveServerConfig.mockResolvedValue(null);

      const source = await buildPhotoImageSource('p1');

      expect(source).toBeNull();
    });
  });
});
