import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PhotosTab from '../../../src/components/checkin/PhotosTab';
import { fetchPhotosForDate, uploadPhoto, buildPhotoImageSource } from '../../../src/services/api/checkInPhotosApi';
import { pickImageFromCamera } from '../../../src/utils/pickImage';

jest.mock('../../../src/services/api/checkInPhotosApi');
jest.mock('../../../src/utils/pickImage');

const mockFetchPhotosForDate = fetchPhotosForDate as jest.MockedFunction<typeof fetchPhotosForDate>;
const mockUploadPhoto = uploadPhoto as jest.MockedFunction<typeof uploadPhoto>;
const mockBuildPhotoImageSource = buildPhotoImageSource as jest.MockedFunction<typeof buildPhotoImageSource>;
const mockPickImageFromCamera = pickImageFromCamera as jest.MockedFunction<typeof pickImageFromCamera>;

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PhotosTab selectedDate="2026-08-24" navigation={{ navigate: jest.fn() } as never} />
    </QueryClientProvider>,
  );
}

describe('PhotosTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPhotosForDate.mockResolvedValue([]);
    mockBuildPhotoImageSource.mockResolvedValue(null);
  });

  test('renders three empty slots (front, back, side) with no photos', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Front')).toBeTruthy();
    });
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Side')).toBeTruthy();
  });

  test('tapping an empty slot opens the camera/library action sheet, and picking a camera photo uploads it', async () => {
    mockPickImageFromCamera.mockResolvedValue({ status: 'ok', image: { uri: 'file:///tmp/front.jpg' } });
    mockUploadPhoto.mockResolvedValue({ id: 'p1', user_id: 'u1', check_in_measurement_id: null, entry_date: '2026-08-24', photo_type: 'front', file_path: 'x.jpg', created_at: '2026-08-24T00:00:00.000Z' });

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Front')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('photo-slot-front'));
    fireEvent.press(await screen.findByText('Take Photo'));

    await waitFor(() => {
      expect(mockUploadPhoto).toHaveBeenCalledWith('2026-08-24', 'front', 'file:///tmp/front.jpg');
    });
  });

  test('renders a Compare button that navigates to the comparison screen', async () => {
    const navigate = jest.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PhotosTab selectedDate="2026-08-24" navigation={{ navigate } as never} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Compare')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Compare'));

    expect(navigate).toHaveBeenCalledWith('ProgressPhotosCompare');
  });
});
