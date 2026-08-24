import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPhotoDates,
  fetchPhotosForDate,
  uploadPhoto,
  deletePhoto,
  buildPhotoImageSource,
  type CheckInPhoto,
  type PhotoType,
} from '../services/api/checkInPhotosApi';
import { checkInPhotoDatesQueryKey, checkInPhotosQueryKey } from './queryKeys';

export function useCheckInPhotoDates() {
  return useQuery({
    queryKey: checkInPhotoDatesQueryKey,
    queryFn: fetchPhotoDates,
  });
}

export function useCheckInPhotosForDate(date: string) {
  return useQuery({
    queryKey: checkInPhotosQueryKey(date),
    queryFn: () => fetchPhotosForDate(date),
    enabled: Boolean(date),
  });
}

function invalidatePhotoQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
): void {
  queryClient.invalidateQueries({ queryKey: checkInPhotosQueryKey(date) });
  queryClient.invalidateQueries({ queryKey: checkInPhotoDatesQueryKey });
}

export function useUploadCheckInPhotoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, type, uri }: { date: string; type: PhotoType; uri: string }): Promise<CheckInPhoto> =>
      uploadPhoto(date, type, uri),
    onSuccess: (_data, variables) => {
      invalidatePhotoQueries(queryClient, variables.date);
    },
  });
}

export function useDeleteCheckInPhotoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; entryDate: string }): Promise<void> => deletePhoto(id),
    onSuccess: (_data, variables) => {
      invalidatePhotoQueries(queryClient, variables.entryDate);
    },
  });
}

/** Resolves an authenticated `<SafeImage>` source for a photo id, or a null source while there is no id. */
export function useCheckInPhotoImageSource(photoId: string | undefined) {
  const query = useQuery({
    queryKey: ['checkInPhotoImageSource', photoId] as const,
    queryFn: () => buildPhotoImageSource(photoId as string),
    enabled: Boolean(photoId),
  });

  return {
    source: query.data ?? null,
    isLoading: Boolean(photoId) && query.isLoading,
  };
}
