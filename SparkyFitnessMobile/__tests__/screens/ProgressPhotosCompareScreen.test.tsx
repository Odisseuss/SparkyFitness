import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ProgressPhotosCompareScreen from '../../src/screens/ProgressPhotosCompareScreen';
import { fetchPhotoDates, fetchPhotosForDate, buildPhotoImageSource } from '../../src/services/api/checkInPhotosApi';

jest.mock('../../src/services/api/checkInPhotosApi');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ setOptions: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
  useNativeIOSTabsActive: () => false,
}));

const mockFetchPhotoDates = fetchPhotoDates as jest.MockedFunction<typeof fetchPhotoDates>;
const mockFetchPhotosForDate = fetchPhotosForDate as jest.MockedFunction<typeof fetchPhotosForDate>;
const mockBuildPhotoImageSource = buildPhotoImageSource as jest.MockedFunction<typeof buildPhotoImageSource>;

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={queryClient}>
        <ProgressPhotosCompareScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('ProgressPhotosCompareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPhotoDates.mockResolvedValue(['2026-08-01', '2026-08-24']);
    mockFetchPhotosForDate.mockResolvedValue([]);
    mockBuildPhotoImageSource.mockResolvedValue(null);
  });

  test('renders the title and two date pickers', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Compare Photos')).toBeTruthy();
    });
    expect(screen.getByText('Front')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Side')).toBeTruthy();
  });

  test('shows a "No photo" placeholder for a type missing on one side', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getAllByText('No photo').length).toBeGreaterThan(0);
    });
  });
});
