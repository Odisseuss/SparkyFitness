import { fetchMoodForDate, saveMood } from '../../src/services/api/moodApi';
import { getActiveServerConfig, ServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: jest.requireActual('../../src/services/storage').proxyHeadersToRecord,
}));

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

const mockGetActiveServerConfig = getActiveServerConfig as jest.MockedFunction<typeof getActiveServerConfig>;

describe('moodApi', () => {
  const mockFetch = jest.fn();
  const testConfig: ServerConfig = { id: 'test-id', url: 'https://example.com', apiKey: 'test-api-key-12345' };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  describe('fetchMoodForDate', () => {
    test('sends GET request to /api/mood/date/:entryDate', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'm1', mood_value: 60, mood_tags: ['calm'], notes: '', entry_date: '2026-08-24' }) });

      await fetchMoodForDate('2026-08-24');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/mood/date/2026-08-24',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    test('returns null on a 404 (no entry for that date)', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('Not found') });

      const result = await fetchMoodForDate('2026-08-24');

      expect(result).toBeNull();
    });

    test('rethrows a non-404 server error', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Internal Server Error') });

      await expect(fetchMoodForDate('2026-08-24')).rejects.toThrow('Server error: 500 - Internal Server Error');
    });
  });

  describe('saveMood', () => {
    test('sends POST request to /api/mood with the entry body', async () => {
      mockGetActiveServerConfig.mockResolvedValue(testConfig);
      const responseData = { id: 'm1', mood_value: 70, mood_tags: ['calm', 'confident'], notes: 'Good day', entry_date: '2026-08-24' };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(responseData) });

      const result = await saveMood({ mood_value: 70, mood_tags: ['calm', 'confident'], notes: 'Good day', entry_date: '2026-08-24' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/mood',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mood_value: 70, mood_tags: ['calm', 'confident'], notes: 'Good day', entry_date: '2026-08-24' }),
        }),
      );
      expect(result).toEqual(responseData);
    });
  });
});
