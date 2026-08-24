import { fetchSleepEntries, saveSleepEntry, updateSleepEntry, deleteSleepEntry } from '../../src/services/api/sleepApi';
import { getActiveServerConfig, ServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: jest.requireActual('../../src/services/storage').proxyHeadersToRecord,
}));

jest.mock('../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

const mockGetActiveServerConfig = getActiveServerConfig as jest.MockedFunction<typeof getActiveServerConfig>;

describe('sleepApi', () => {
  const mockFetch = jest.fn();
  const testConfig: ServerConfig = { id: 'test-id', url: 'https://example.com', apiKey: 'test-api-key-12345' };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
  });

  test('fetchSleepEntries sends GET to /api/sleep with startDate/endDate', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await fetchSleepEntries('2026-08-24', '2026-08-24');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep?startDate=2026-08-24&endDate=2026-08-24',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('saveSleepEntry sends POST to /api/sleep/manual_entry with the payload', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    const payload = {
      entry_date: '2026-08-24',
      bedtime: '2026-08-23T22:30:00.000Z',
      wake_time: '2026-08-24T06:30:00.000Z',
      duration_in_seconds: 28800,
      record_timezone: 'America/New_York',
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 's1', ...payload, source: 'manual' }) });

    await saveSleepEntry(payload);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep/manual_entry',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
    );
  });

  test('updateSleepEntry sends PUT to /api/sleep/:id', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    const payload = {
      bedtime: '2026-08-23T22:00:00.000Z',
      wake_time: '2026-08-24T06:00:00.000Z',
      duration_in_seconds: 28800,
      record_timezone: 'America/New_York',
    };
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 's1', entry_date: '2026-08-24', source: 'manual', ...payload }) });

    await updateSleepEntry('s1', payload);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep/s1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) }),
    );
  });

  test('deleteSleepEntry sends DELETE to /api/sleep/:id', async () => {
    mockGetActiveServerConfig.mockResolvedValue(testConfig);
    mockFetch.mockResolvedValue({ ok: true, status: 204, headers: { get: () => '0' } });

    await deleteSleepEntry('s1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/sleep/s1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
