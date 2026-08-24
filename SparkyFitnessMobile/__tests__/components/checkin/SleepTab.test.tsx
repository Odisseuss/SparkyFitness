import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SleepTab from '../../../src/components/checkin/SleepTab';
import { fetchSleepEntries, saveSleepEntry, updateSleepEntry, deleteSleepEntry } from '../../../src/services/api/sleepApi';

jest.mock('../../../src/services/api/sleepApi');

// TimeSheet is a bottom-sheet time wheel; stub it as a button that reports a
// fixed time distinguishable per test-id, so bedtime/wake time can be set
// independently without driving the real wheel UI.
jest.mock('../../../src/components/TimeSheet', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        { onSelectTime, testID }: { onSelectTime: (t: string) => void; testID?: string },
        ref: React.Ref<unknown>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          present: () => onSelectTime(testID === 'bedtime-sheet' ? '22:00' : '06:00'),
          dismiss: jest.fn(),
        }));
        return <TouchableOpacity testID={testID}><Text>TimeSheet</Text></TouchableOpacity>;
      },
    ),
  };
});

const mockFetchSleepEntries = fetchSleepEntries as jest.MockedFunction<typeof fetchSleepEntries>;
const mockSaveSleepEntry = saveSleepEntry as jest.MockedFunction<typeof saveSleepEntry>;
const mockUpdateSleepEntry = updateSleepEntry as jest.MockedFunction<typeof updateSleepEntry>;
const mockDeleteSleepEntry = deleteSleepEntry as jest.MockedFunction<typeof deleteSleepEntry>;

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SleepTab selectedDate="2026-08-24" />
    </QueryClientProvider>,
  );
}

describe('SleepTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSleepEntries.mockResolvedValue([]);
  });

  test('renders bedtime/wake time pickers and a save button', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Bedtime')).toBeTruthy();
    });
    expect(screen.getByText('Wake Time')).toBeTruthy();
    expect(screen.getByText('Save Sleep')).toBeTruthy();
  });

  test('entering bedtime and wake time then saving calls saveSleepEntry with a computed duration', async () => {
    mockSaveSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 28800, source: 'manual' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('bedtime-sheet')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('bedtime-sheet'));
    fireEvent.press(screen.getByTestId('waketime-sheet'));
    fireEvent.press(screen.getByText('Save Sleep'));

    await waitFor(() => {
      expect(mockSaveSleepEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entry_date: '2026-08-24', duration_in_seconds: 8 * 60 * 60 }),
      );
    });
  });

  test('lists an existing entry for the date with edit and delete actions', async () => {
    mockFetchSleepEntries.mockResolvedValue([
      { id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' },
    ]);

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('delete-sleep-s1')).toBeTruthy();
    });
    expect(screen.getByTestId('edit-sleep-s1')).toBeTruthy();
  });

  test('tapping edit then Save Sleep calls updateSleepEntry (not saveSleepEntry) for that entry', async () => {
    mockFetchSleepEntries.mockResolvedValue([
      { id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' },
    ]);
    mockUpdateSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 28800, source: 'manual' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('edit-sleep-s1')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('edit-sleep-s1'));
    // Editing pre-fills bedtime/wake from the entry, so Save Sleep is
    // pressable immediately without re-selecting either time.
    fireEvent.press(screen.getByText('Save Sleep'));

    await waitFor(() => {
      expect(mockUpdateSleepEntry).toHaveBeenCalledWith('s1', expect.objectContaining({ record_timezone: expect.any(String) }));
    });
    expect(mockSaveSleepEntry).not.toHaveBeenCalled();
  });

  test('deleting an entry calls deleteSleepEntry with its id', async () => {
    mockFetchSleepEntries.mockResolvedValue([
      { id: 's1', entry_date: '2026-08-24', bedtime: '2026-08-23T22:00:00.000Z', wake_time: '2026-08-24T06:00:00.000Z', duration_in_seconds: 28800, source: 'manual' },
    ]);
    mockDeleteSleepEntry.mockResolvedValue(undefined);

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('delete-sleep-s1')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('delete-sleep-s1'));

    await waitFor(() => {
      expect(mockDeleteSleepEntry).toHaveBeenCalledWith('s1');
    });
  });
});
