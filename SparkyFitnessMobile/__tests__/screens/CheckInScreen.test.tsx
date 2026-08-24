import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CheckInScreen from '../../src/screens/CheckInScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
  useNativeIOSTabsActive: () => false,
}));

jest.mock('../../src/components/checkin/MeasurementsTab', () => {
  const { View, Text } = require('react-native');
  return { __esModule: true, default: () => <View><Text>Measurements content</Text></View> };
});
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
  test('renders all four segment labels and defaults to Measurements', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Measurements content')).toBeTruthy();
    });
    expect(screen.getByText('Measurements')).toBeTruthy();
    expect(screen.getByText('Fasting & Mood')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('Photos')).toBeTruthy();
  });

  test('switching segments swaps the rendered tab content', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Measurements content')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Sleep'));

    expect(screen.getByText('Sleep content')).toBeTruthy();
    expect(screen.queryByText('Measurements content')).toBeNull();
  });
});
