// SparkyFitnessMobile/__tests__/components/checkin/FastingMoodTab.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FastingMoodTab from '../../../src/components/checkin/FastingMoodTab';
import { fetchMoodForDate, saveMood } from '../../../src/services/api/moodApi';

jest.mock('../../../src/services/api/moodApi');
jest.mock('../../../src/components/FastingCard', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="fasting-card" /> };
});

const mockFetchMoodForDate = fetchMoodForDate as jest.MockedFunction<typeof fetchMoodForDate>;
const mockSaveMood = saveMood as jest.MockedFunction<typeof saveMood>;

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FastingMoodTab selectedDate="2026-08-24" navigation={{} as never} />
    </QueryClientProvider>,
  );
}

describe('FastingMoodTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMoodForDate.mockResolvedValue(null);
    mockSaveMood.mockResolvedValue({ id: 'm1', mood_value: 50, mood_tags: [], notes: '', entry_date: '2026-08-24' });
  });

  test('renders the FastingCard and the mood form', async () => {
    renderTab();

    expect(screen.getByTestId('fasting-card')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('How are you feeling today?')).toBeTruthy();
    });
  });

  test('toggling a mood chip and saving calls saveMood with the tag included', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Calm')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Calm'));
    fireEvent.press(screen.getByText('Save Mood'));

    await waitFor(() => {
      expect(mockSaveMood).toHaveBeenCalledWith(
        expect.objectContaining({ mood_tags: expect.arrayContaining(['calm']), entry_date: '2026-08-24' }),
      );
    });
  });

  test('deselecting a banded chip after manually adjusting the stepper does not re-jump the intensity', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Calm')).toBeTruthy();
    });

    // Selecting the "Calm" chip (band 65) should jump the stepper to 65.
    fireEvent.press(screen.getByText('Calm'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('65')).toBeTruthy();
    });

    // Simulate the user manually moving the stepper away from the band value,
    // then blurring so the committed value (not an in-progress draft) drives
    // what's displayed.
    const input = screen.getByDisplayValue('65');
    fireEvent.changeText(input, '70');
    fireEvent(input, 'blur');
    await waitFor(() => {
      expect(screen.getByDisplayValue('70')).toBeTruthy();
    });

    // Deselecting "Calm" must not snap the intensity back to its band value.
    fireEvent.press(screen.getByText('Calm'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('70')).toBeTruthy();
    });
    expect(screen.queryByDisplayValue('65')).toBeNull();
  });

  test('pre-fills the slider and tags from an existing entry for the date', async () => {
    mockFetchMoodForDate.mockResolvedValue({ id: 'm1', mood_value: 80, mood_tags: ['happy'], notes: 'Great workout', entry_date: '2026-08-24' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Great workout')).toBeTruthy();
    });
  });
});
