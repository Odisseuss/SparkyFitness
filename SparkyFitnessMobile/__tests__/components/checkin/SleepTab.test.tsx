import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SleepTab from '../../../src/components/checkin/SleepTab';
import { fetchSleepEntries, saveSleepEntry, updateSleepEntry, deleteSleepEntry } from '../../../src/services/api/sleepApi';
import { toBedtimeWakeTimeDates } from '../../../src/utils/sleepCalculations';

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
          present: jest.fn(),
          dismiss: jest.fn(),
        }));
        return (
          <TouchableOpacity
            testID={testID}
            onPress={() => onSelectTime(testID === 'bedtime-sheet' ? '22:00' : '06:00')}
          >
            <Text>TimeSheet</Text>
          </TouchableOpacity>
        );
      },
    ),
    dateToTimeString: (date: Date) =>
      `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
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

  test('tapping edit then Save Sleep calls updateSleepEntry (not saveSleepEntry) for that entry, without shifting the original local time', async () => {
    // Built from LOCAL clock components (not a literal UTC ISO string), so
    // '22:00'/'06:00' below are exactly this entry's local bedtime/wake time
    // by construction — valid in whatever zone Jest happens to run in. (The
    // process timezone can't be forced at runtime once V8 has cached it; see
    // the same convention in __tests__/utils/dateUtils.test.ts.) A regression
    // back to UTC-based extraction (`toISOString().slice(11, 16)`) would only
    // coincide with this in an actual UTC environment; anywhere else it
    // shifts the reconstructed instants by the local UTC offset, which is
    // exactly the bug this test guards against.
    const bedtimeLocal = new Date(2026, 7, 23, 22, 0); // Aug 23, 22:00 local
    const wakeTimeLocal = new Date(2026, 7, 24, 6, 0); // Aug 24, 06:00 local
    const bedtimeIso = bedtimeLocal.toISOString();
    const wakeTimeIso = wakeTimeLocal.toISOString();

    mockFetchSleepEntries.mockResolvedValue([
      { id: 's1', entry_date: '2026-08-24', bedtime: bedtimeIso, wake_time: wakeTimeIso, duration_in_seconds: 28800, source: 'manual' },
    ]);
    mockUpdateSleepEntry.mockResolvedValue({ id: 's1', entry_date: '2026-08-24', bedtime: '', wake_time: '', duration_in_seconds: 28800, source: 'manual' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('edit-sleep-s1')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('edit-sleep-s1'));
    // Editing pre-fills bedtime/wake from the entry, so Save Sleep is
    // pressable immediately without re-selecting either time — the exact path
    // that silently corrupted the entry under the UTC-extraction bug.
    fireEvent.press(screen.getByText('Save Sleep'));

    // Expected instants: reconstruct from the entry's own known-local clock
    // time ('22:00'/'06:00' by construction above), the same way handleEdit +
    // Save should. Computed independently of SleepTab's implementation.
    const { bed: expectedBed, wake: expectedWake } = toBedtimeWakeTimeDates('2026-08-24', '22:00', '06:00');
    // Sanity check on the test's own expectation: reconstructing from the
    // known local clock time must reproduce the original instants exactly.
    expect(expectedBed.toISOString()).toBe(bedtimeIso);
    expect(expectedWake.toISOString()).toBe(wakeTimeIso);

    await waitFor(() => {
      expect(mockUpdateSleepEntry).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          bedtime: expectedBed.toISOString(),
          wake_time: expectedWake.toISOString(),
          duration_in_seconds: Math.round((expectedWake.getTime() - expectedBed.getTime()) / 1000),
          record_timezone: expect.any(String),
        }),
      );
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
