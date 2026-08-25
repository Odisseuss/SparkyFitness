// SparkyFitnessMobile/__tests__/components/checkin/FastingMoodTab.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FastingMoodTab from '../../../src/components/checkin/FastingMoodTab';
import { fetchMoodForDate, saveMood } from '../../../src/services/api/moodApi';
import { moodQueryKey } from '../../../src/hooks/queryKeys';

jest.mock('../../../src/services/api/moodApi');
jest.mock('../../../src/components/FastingCard', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="fasting-card" /> };
});

const mockFetchMoodForDate = fetchMoodForDate as jest.MockedFunction<typeof fetchMoodForDate>;
const mockSaveMood = saveMood as jest.MockedFunction<typeof saveMood>;

function renderTabWithClient(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <FastingMoodTab selectedDate="2026-08-24" navigation={{} as never} />
    </QueryClientProvider>,
  );
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderTabWithClient(queryClient);
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

  test('selecting a mood tag chip does not change the overall mood value', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Calm')).toBeTruthy();
    });

    const slider = screen.getByLabelText('Overall mood');
    expect(slider.props.accessibilityValue.now).toBe(50);

    // Selecting the "Calm" chip (a banded mood) must only toggle the tag --
    // it must never move the intensity slider.
    fireEvent.press(screen.getByText('Calm'));
    expect(slider.props.accessibilityValue.now).toBe(50);

    fireEvent.press(screen.getByText('Save Mood'));
    await waitFor(() => {
      expect(mockSaveMood).toHaveBeenCalledWith(
        expect.objectContaining({ mood_value: 50, mood_tags: ['calm'], entry_date: '2026-08-24' }),
      );
    });
  });

  test('tapping a band emoji in the quick-jump row sets the intensity directly', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByLabelText('Calm')).toBeTruthy();
    });

    const slider = screen.getByLabelText('Overall mood');
    expect(slider.props.accessibilityValue.now).toBe(50);

    // "Calm" is a banded mood (band 65); tapping its quick-jump emoji sets
    // the slider directly and must not touch the mood-tag chips.
    fireEvent.press(screen.getByLabelText('Calm'));
    expect(slider.props.accessibilityValue.now).toBe(65);

    fireEvent.press(screen.getByText('Save Mood'));
    await waitFor(() => {
      expect(mockSaveMood).toHaveBeenCalledWith(
        expect.objectContaining({ mood_value: 65, mood_tags: [], entry_date: '2026-08-24' }),
      );
    });
  });

  test('pre-fills the slider and tags from an existing entry for the date', async () => {
    mockFetchMoodForDate.mockResolvedValue({ id: 'm1', mood_value: 80, mood_tags: ['happy'], notes: 'Great workout', entry_date: '2026-08-24' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Great workout')).toBeTruthy();
    });
    expect(screen.getByLabelText('Overall mood').props.accessibilityValue.now).toBe(80);
  });

  test('shows the cached entry immediately when the mood query is already cached on mount, instead of the hardcoded defaults', async () => {
    // Simulate a date the user already viewed earlier in this session: the
    // query result is already in the cache before the component ever mounts,
    // so useMoodForDate resolves synchronously with isLoading: false on the
    // very first render (default staleTime is Infinity, per AGENTS.md).
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(moodQueryKey('2026-08-24'), {
      id: 'm1',
      mood_value: 80,
      mood_tags: ['happy'],
      notes: 'Great workout',
      entry_date: '2026-08-24',
    });

    renderTabWithClient(queryClient);

    // The cached entry's values must be visible immediately -- no loading
    // spinner should ever appear, and the hardcoded defaults (mood 50, no
    // tags, empty notes) must never be shown even transiently.
    expect(screen.getByDisplayValue('Great workout')).toBeTruthy();
    expect(screen.getByLabelText('Overall mood').props.accessibilityValue.now).toBe(80);
  });
});
