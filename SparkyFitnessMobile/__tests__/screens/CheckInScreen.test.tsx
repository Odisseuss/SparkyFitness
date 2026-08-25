import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CheckInScreen from '../../src/screens/CheckInScreen';
import { useMeasurements } from '../../src/hooks/useMeasurements';
import { usePreferences } from '../../src/hooks/usePreferences';
import { useUpsertCheckIn } from '../../src/hooks/useUpsertCheckIn';
import {
  useCustomCategories,
  useCustomMeasurementsByDate,
  useSaveCustomMeasurement,
  useDeleteCustomMeasurement,
} from '../../src/hooks/useCustomMeasurements';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
  useNativeIOSTabsActive: () => false,
}));

// MeasurementsTab is intentionally NOT stubbed — this file's routing test
// (below) renders the real component so it exercises the actual
// registerSaveHandler/onStateChange contract with CheckInScreen. Its data
// dependencies are mocked the same way MeasurementsTab.test.tsx mocks them.
jest.mock('../../src/hooks/useMeasurements', () => ({
  useMeasurements: jest.fn(),
}));
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: jest.fn(),
}));
jest.mock('../../src/hooks/useUpsertCheckIn', () => ({
  useUpsertCheckIn: jest.fn(),
}));
jest.mock('../../src/hooks/useCustomMeasurements', () => ({
  useCustomCategories: jest.fn(),
  useCustomMeasurementsByDate: jest.fn(),
  useSaveCustomMeasurement: jest.fn(),
  useDeleteCustomMeasurement: jest.fn(),
}));

jest.mock('../../src/components/checkin/FastingMoodTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Fasting content</Text></View> };
});
jest.mock('../../src/components/checkin/SleepTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Sleep content</Text></View> };
});
jest.mock('../../src/components/checkin/PhotosTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Photos content</Text></View> };
});

const mockUseMeasurements = useMeasurements as jest.MockedFunction<typeof useMeasurements>;
const mockUsePreferences = usePreferences as jest.MockedFunction<typeof usePreferences>;
const mockUseUpsertCheckIn = useUpsertCheckIn as jest.MockedFunction<typeof useUpsertCheckIn>;
const mockUseCustomCategories = useCustomCategories as jest.MockedFunction<typeof useCustomCategories>;
const mockUseCustomMeasurementsByDate = useCustomMeasurementsByDate as jest.MockedFunction<
  typeof useCustomMeasurementsByDate
>;
const mockUseSaveCustomMeasurement = useSaveCustomMeasurement as jest.MockedFunction<
  typeof useSaveCustomMeasurement
>;
const mockUseDeleteCustomMeasurement = useDeleteCustomMeasurement as jest.MockedFunction<
  typeof useDeleteCustomMeasurement
>;

const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={{ insets, frame }}>
        <CheckInScreen navigation={{} as never} route={{ params: undefined } as never} />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe('CheckInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Minimal-but-valid default state for the real MeasurementsTab, mirroring
    // MeasurementsTab.test.tsx's defaults: nothing prefilled, kg/cm units.
    mockUseMeasurements.mockReturnValue({
      measurements: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useMeasurements>);
    mockUsePreferences.mockReturnValue({
      preferences: { default_weight_unit: 'kg', default_measurement_unit: 'cm' },
      isLoading: false,
    } as unknown as ReturnType<typeof usePreferences>);
    mockUseUpsertCheckIn.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
    } as unknown as ReturnType<typeof useUpsertCheckIn>);
    mockUseCustomCategories.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useCustomCategories>);
    mockUseCustomMeasurementsByDate.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useCustomMeasurementsByDate>);
    mockUseSaveCustomMeasurement.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
    } as unknown as ReturnType<typeof useSaveCustomMeasurement>);
    mockUseDeleteCustomMeasurement.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn().mockResolvedValue(undefined),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteCustomMeasurement>);
  });

  test('renders all four segment labels and defaults to Measurements', async () => {
    renderScreen();

    // The real MeasurementsTab is rendered by default; "Weight (kg)" is its
    // first field label once loading settles.
    await waitFor(() => {
      expect(screen.getByText('Weight (kg)')).toBeTruthy();
    });
    expect(screen.getByText('Measurements')).toBeTruthy();
    expect(screen.getByText('Fasting & Mood')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('Photos')).toBeTruthy();
  });

  test('switching segments swaps the rendered tab content', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Weight (kg)')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sleep'));

    expect(screen.getByText('Sleep content')).toBeTruthy();
    expect(screen.queryByText('Weight (kg)')).toBeNull();
  });

  test('Save routing: the Measurements-only save action appears only on the Measurements tab and drives the real save flow', async () => {
    // Prefilled weight so the real MeasurementsTab's save resolves straight
    // to the upsert mutation (no confirmation Alert in the way).
    mockUseMeasurements.mockReturnValue({
      measurements: { weight: 80 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useMeasurements>);
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    mockUseUpsertCheckIn.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpsertCheckIn>);

    renderScreen();

    // (a) On the default Measurements tab, the sticky footer Save action
    // (this test's usesNativeHeader mock is false) is present.
    await waitFor(() => {
      expect(screen.getByText('Weight (kg)')).toBeTruthy();
    });
    expect(screen.getByText('Save')).toBeTruthy();

    // (b) Switching to a different tab removes it — Save is Measurements-only.
    fireEvent.press(screen.getByText('Sleep'));
    expect(screen.getByText('Sleep content')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();

    // Switch back to Measurements: the Save action reappears.
    fireEvent.press(screen.getByText('Measurements'));
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeTruthy();
    });

    // (c) Pressing Save invokes the real save flow registered by the real
    // MeasurementsTab — i.e. it reaches the mocked upsert mutation.
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
      await Promise.resolve();
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ entryDate: expect.any(String), weight: 80 }),
    );
  });
});
